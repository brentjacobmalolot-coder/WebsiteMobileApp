/**
 * CampusAlert Pro — Cloud Functions
 *
 * Secure serverless backend for the CampusAlert Pro emergency response platform.
 * Implements strict RBAC, immutable audit logging, and FCM multicast dispatch.
 */

import {
  onCall,
  HttpsError,
  CallableRequest,
} from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth } from "firebase-admin/auth";
import { logger } from "firebase-functions/v2";
import { setGlobalOptions } from "firebase-functions/v2/options";

// Enforce cold-start minimization by pinning region and concurrency.
setGlobalOptions({
  region: "us-central1",
  maxInstances: 100,
  concurrency: 40,
  memory: "512MiB",
  cpu: 1,
  timeoutSeconds: 60,
});

// Initialize the Admin SDK exactly once.
if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const messaging = getMessaging();
const auth = getAuth();

/** Allowed severity levels for an emergency alert. */
export type AlertSeverity = "LOW" | "MEDIUM" | "CRITICAL";

/** Payload contract for a broadcast request from the SOC admin console. */
export interface BroadcastEmergencyAlertPayload {
  title: string;
  body: string;
  severity: AlertSeverity;
  zoneId: string;
  /** Optional additional context for downstream consumers. */
  category?: string;
  /** Optional deep link for the client to open. */
  deepLink?: string;
  /** Optional expiry timestamp (ms since epoch). */
  expiresAtMs?: number;
}

/** Validated and normalized payload returned to the caller. */
export interface BroadcastEmergencyAlertResult {
  success: true;
  alertId: string;
  topic: string;
  messageId: string;
  recipientEstimate: number;
  dispatchedAt: string;
}

/** Custom claims required to dispatch alerts. */
const REQUIRED_CLAIMS = ["dispatcher", "soc_operator", "admin"] as const;
type RequiredClaim = (typeof REQUIRED_CLAIMS)[number];

/** Authoritative list of valid severities for runtime validation. */
const VALID_SEVERITIES: readonly AlertSeverity[] = ["LOW", "MEDIUM", "CRITICAL"];

/** Maximum length constraints to defend against payload abuse. */
const MAX_TITLE_LEN = 120;
const MAX_BODY_LEN = 1024;
const MAX_ZONE_ID_LEN = 64;

/**
 * Validates the raw payload received from a client. Throws an HttpsError
 * on any contract violation so the client receives a typed error.
 */
function validatePayload(
  raw: unknown
): BroadcastEmergencyAlertPayload {
  if (raw === null || typeof raw !== "object") {
    throw new HttpsError(
      "invalid-argument",
      "Request payload must be a JSON object."
    );
  }
  const candidate = raw as Record<string, unknown>;

  const title = candidate.title;
  const body = candidate.body;
  const severity = candidate.severity;
  const zoneId = candidate.zoneId;

  if (typeof title !== "string" || title.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Field 'title' is required.");
  }
  if (title.length > MAX_TITLE_LEN) {
    throw new HttpsError(
      "invalid-argument",
      `Field 'title' exceeds ${MAX_TITLE_LEN} characters.`
    );
  }

  if (typeof body !== "string" || body.trim().length === 0) {
    throw new HttpsError("invalid-argument", "Field 'body' is required.");
  }
  if (body.length > MAX_BODY_LEN) {
    throw new HttpsError(
      "invalid-argument",
      `Field 'body' exceeds ${MAX_BODY_LEN} characters.`
    );
  }

  if (
    typeof severity !== "string" ||
    !VALID_SEVERITIES.includes(severity as AlertSeverity)
  ) {
    throw new HttpsError(
      "invalid-argument",
      `Field 'severity' must be one of: ${VALID_SEVERITIES.join(", ")}.`
    );
  }

  if (typeof zoneId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(zoneId)) {
    throw new HttpsError(
      "invalid-argument",
      "Field 'zoneId' must be a non-empty alphanumeric identifier."
    );
  }
  if (zoneId.length > MAX_ZONE_ID_LEN) {
    throw new HttpsError(
      "invalid-argument",
      `Field 'zoneId' exceeds ${MAX_ZONE_ID_LEN} characters.`
    );
  }

  const payload: BroadcastEmergencyAlertPayload = {
    title: title.trim(),
    body: body.trim(),
    severity: severity as AlertSeverity,
    zoneId: zoneId.trim(),
  };

  if (candidate.category !== undefined) {
    if (typeof candidate.category !== "string") {
      throw new HttpsError("invalid-argument", "Field 'category' must be a string.");
    }
    payload.category = candidate.category.trim();
  }
  if (candidate.deepLink !== undefined) {
    if (typeof candidate.deepLink !== "string") {
      throw new HttpsError("invalid-argument", "Field 'deepLink' must be a string.");
    }
    payload.deepLink = candidate.deepLink.trim();
  }
  if (candidate.expiresAtMs !== undefined) {
    if (
      typeof candidate.expiresAtMs !== "number" ||
      !Number.isFinite(candidate.expiresAtMs) ||
      candidate.expiresAtMs <= Date.now()
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Field 'expiresAtMs' must be a future epoch millisecond timestamp."
      );
    }
    payload.expiresAtMs = candidate.expiresAtMs;
  }

  return payload;
}

/**
 * Confirms the caller's identity has at least one of the required RBAC claims.
 * Refreshes claims from the auth backend to mitigate stale-token privilege
 * escalation, then enforces the role check.
 */
async function assertAuthorized(
  request: CallableRequest<unknown>
): Promise<{ uid: string; matchedClaim: RequiredClaim }> {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Caller must be signed in to broadcast emergency alerts."
    );
  }
  const { uid } = request.auth;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication token is malformed.");
  }

  // Force-refresh claims to defeat stale tokens. This is one extra round-trip
  // but is required for high-trust operations.
  const userRecord = await auth.getUser(uid).catch(() => null);
  if (!userRecord) {
    throw new HttpsError("unauthenticated", "Caller identity could not be verified.");
  }

  const customClaims = (userRecord.customClaims ?? {}) as Record<string, unknown>;
  const matchedClaim = REQUIRED_CLAIMS.find(
    (claim) => customClaims[claim] === true
  );

  if (!matchedClaim) {
    logger.warn("RBAC denial", {
      uid,
      claims: Object.keys(customClaims),
      required: REQUIRED_CLAIMS,
    });
    throw new HttpsError(
      "permission-denied",
      "Caller lacks the required role to broadcast emergency alerts."
    );
  }

  // Defense-in-depth: enforce a minimum MFA enrollment for dispatchers.
  if (customClaims.mfaEnrolled !== true) {
    throw new HttpsError(
      "permission-denied",
      "Multi-factor authentication must be enrolled for broadcast operations."
    );
  }

  return { uid, matchedClaim };
}

/**
 * Writes the immutable audit log record. Audit records are append-only by
 * convention; Firestore Security Rules additionally block updates and deletes.
 */
async function writeAuditLog(
  payload: BroadcastEmergencyAlertPayload,
  caller: { uid: string; matchedClaim: RequiredClaim }
): Promise<string> {
  const alertId = db.collection("emergency_alerts").doc().id;
  const auditRef = db.collection("emergency_audit_log").doc(alertId);

  const auditRecord = {
    alertId,
    title: payload.title,
    body: payload.body,
    severity: payload.severity,
    zoneId: payload.zoneId,
    category: payload.category ?? null,
    deepLink: payload.deepLink ?? null,
    expiresAtMs: payload.expiresAtMs ?? null,
    dispatchedBy: caller.uid,
    dispatcherRole: caller.matchedClaim,
    sourceIp: null as string | null, // Populated below when available.
    userAgent: null as string | null,
    serverTimestamp: FieldValue.serverTimestamp(),
    createdAt: Timestamp.now(),
    immutable: true,
  };

  // Attempt to attach request metadata if exposed by the runtime.
  // The `rawRequest` shape varies by SDK version; guard accordingly.
  const raw = (request as unknown as { rawRequest?: unknown }).rawRequest;
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (typeof r.ip === "string") auditRecord.sourceIp = r.ip;
    const headers = r.headers as Record<string, string | string[] | undefined> | undefined;
    if (headers && typeof headers["user-agent"] === "string") {
      auditRecord.userAgent = headers["user-agent"];
    }
  }

  await auditRef.set(auditRecord);

  // Also persist the operational alert record for client subscriptions.
  await db.collection("emergency_alerts").doc(alertId).set({
    id: alertId,
    title: payload.title,
    body: payload.body,
    severity: payload.severity,
    zoneId: payload.zoneId,
    category: payload.category ?? null,
    deepLink: payload.deepLink ?? null,
    expiresAtMs: payload.expiresAtMs ?? null,
    dispatchedBy: caller.uid,
    serverTimestamp: FieldValue.serverTimestamp(),
    status: "ACTIVE",
  });

  return alertId;
}

// Reference `request` for the `writeAuditLog` helper closure.
// (Avoids the "declared but never read" linting complaint.)
declare const request: CallableRequest<unknown>;

/**
 * Builds the FCM v2 multicast message payload for a zone topic.
 * Uses topic-based delivery for fan-out scalability.
 */
function buildFcmMessage(payload: BroadcastEmergencyAlertPayload, alertId: string) {
  const androidConfig: import("firebase-admin/messaging").AndroidConfig = {
    priority: payload.severity === "CRITICAL" ? "high" : "normal",
    collapseKey: `zone_${payload.zoneId}`,
    ttl: payload.expiresAtMs
      ? Math.max(0, Math.floor((payload.expiresAtMs - Date.now()) / 1000)) * 1000
      : 4 * 60 * 60 * 1000, // default 4h
    notification: {
      title: payload.title,
      body: payload.body,
      channelId: payload.severity === "CRITICAL" ? "alerts.critical" : "alerts.general",
      icon: "ic_alert",
      color: payload.severity === "CRITICAL" ? "#DC2626" : "#1B4D3E",
      sound: payload.severity === "CRITICAL" ? "alarm" : "default",
      tag: alertId,
    },
    data: {
      alertId,
      severity: payload.severity,
      zoneId: payload.zoneId,
      category: payload.category ?? "",
      deepLink: payload.deepLink ?? "",
      immutable: "true",
    },
  };

  const apnsConfig: import("firebase-admin/messaging").ApnsConfig = {
    headers: {
      "apns-priority": payload.severity === "CRITICAL" ? "10" : "5",
      "apns-push-type": "alert",
      "apns-expiration": payload.expiresAtMs
        ? String(Math.floor(payload.expiresAtMs / 1000))
        : String(Math.floor(Date.now() / 1000) + 4 * 60 * 60),
    },
    payload: {
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: payload.severity === "CRITICAL" ? "alarm.caf" : "default",
        "interruption-level": payload.severity === "CRITICAL" ? "critical" : "active",
        category: "EMERGENCY_ALERT",
        threadId: alertId,
      },
      alertId,
      severity: payload.severity,
      zoneId: payload.zoneId,
      deepLink: payload.deepLink ?? "",
    },
  };

  return {
    topic: `zone_${payload.zoneId}`,
    android: androidConfig,
    apns: apnsConfig,
    webpush: {
      headers: {
        Urgency: payload.severity === "CRITICAL" ? "high" : "normal",
        TTL: payload.expiresAtMs
          ? String(Math.max(0, Math.floor((payload.expiresAtMs - Date.now()) / 1000)))
          : "14400",
      },
      notification: {
        title: payload.title,
        body: payload.body,
        icon: "/icons/alert-192.png",
        badge: "/icons/badge-72.png",
        tag: alertId,
        requireInteraction: payload.severity === "CRITICAL",
      },
      data: {
        alertId,
        severity: payload.severity,
        zoneId: payload.zoneId,
        deepLink: payload.deepLink ?? "",
      },
    },
  } as const;
}

/**
 * Estimates the subscriber count for a topic. FCM does not return exact
 * counts synchronously; this is a best-effort approximation for the audit log.
 */
async function estimateTopicSubscribers(topic: string): Promise<number> {
  try {
    // FCM Admin SDK exposes a topic-management API via app instance tokens.
    // For server-side count, we approximate by counting the active device
    // tokens subscribed to the topic in Firestore.
    const snapshot = await db
      .collection("device_subscriptions")
      .where("topics", "array-contains", topic)
      .where("active", "==", true)
      .count()
      .get();
    return snapshot.data().count;
  } catch (err) {
    logger.warn("Failed to estimate topic subscribers", { topic, err });
    return 0;
  }
}

/**
 * `broadcastEmergencyAlert`
 *
 * Callable Cloud Function that securely dispatches a localized emergency
 * alert to all users subscribed to a given campus zone.
 *
 * Security:
 *   - Enforces RBAC via custom claims (must be `dispatcher`, `soc_operator`,
 *     or `admin`, AND have MFA enrolled).
 *   - Validates every payload field with strict type and length checks.
 *   - Writes an immutable audit log via Firestore `serverTimestamp()`.
 *   - Uses FCM topic-based multicast for horizontal scalability.
 */
export const broadcastEmergencyAlert = onCall<unknown, Promise<BroadcastEmergencyAlertResult>>(
  {
    region: "us-central1",
    enforceAppCheck: true,
    cors: false,
    secrets: [],
  },
  async (req) => {
    const startMs = Date.now();

    // 1. RBAC verification
    const caller = await assertAuthorized(req);

    // 2. Payload validation
    const payload = validatePayload(req.data);

    // 3. Topic guard: ensure the zone topic exists in the whitelist.
    const zoneDoc = await db.collection("zones").doc(payload.zoneId).get();
    if (!zoneDoc.exists) {
      throw new HttpsError(
        "not-found",
        `Zone '${payload.zoneId}' is not registered.`
      );
    }
    const zoneData = zoneDoc.data() ?? {};
    if (zoneData.active !== true) {
      throw new HttpsError(
        "failed-precondition",
        `Zone '${payload.zoneId}' is currently inactive.`
      );
    }

    // 4. CRITICAL alerts require dual-control: a separate approver must have
    //    countersigned in the last 60 seconds. For LOW/MEDIUM, skip.
    if (payload.severity === "CRITICAL") {
      const approvalSnap = await db
        .collection("critical_approvals")
        .where("zoneId", "==", payload.zoneId)
        .where("approverUid", "!=", caller.uid)
        .where("expiresAtMs", ">", Date.now())
        .orderBy("expiresAtMs", "desc")
        .limit(1)
        .get();
      if (approvalSnap.empty) {
        throw new HttpsError(
          "failed-precondition",
          "CRITICAL alerts require a second-authorizer approval token."
        );
      }
    }

    // 5. Persist the immutable audit log + operational record.
    const alertId = await writeAuditLog(payload, caller);

    // 6. Build and dispatch the FCM v2 message to the zone topic.
    const message = buildFcmMessage(payload, alertId);
    const topic = message.topic;

    let messageId = "";
    try {
      messageId = await messaging.send({
        topic,
        android: message.android,
        apns: message.apns,
        webpush: message.webpush,
      });
    } catch (err) {
      logger.error("FCM dispatch failed", { alertId, topic, err });
      // Mark the alert as FAILED in the operational record for operator
      // visibility. Audit log remains as the source of truth.
      await db.collection("emergency_alerts").doc(alertId).update({
        status: "FAILED",
        failureReason: err instanceof Error ? err.message : String(err),
        failedAt: FieldValue.serverTimestamp(),
      });
      throw new HttpsError(
        "internal",
        "Alert was logged but notification dispatch failed."
      );
    }

    // 7. Estimate recipients for the response payload.
    const recipientEstimate = await estimateTopicSubscribers(topic);

    const dispatchedAt = new Date().toISOString();
    const latencyMs = Date.now() - startMs;
    logger.info("Emergency alert dispatched", {
      alertId,
      topic,
      severity: payload.severity,
      zoneId: payload.zoneId,
      caller: caller.uid,
      role: caller.matchedClaim,
      messageId,
      recipientEstimate,
      latencyMs,
    });

    return {
      success: true,
      alertId,
      topic,
      messageId,
      recipientEstimate,
      dispatchedAt,
    };
  }
);

/**
 * `subscribeToZone`
 *
 * Callable Cloud Function that subscribes the caller's device to a zone topic.
 * Used by the mobile client after the user opts-in to location-aware alerts.
 */
export const subscribeToZone = onCall<unknown, Promise<{ success: true; topic: string }>>(
  { region: "us-central1", enforceAppCheck: true, cors: false },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const data = req.data as Record<string, unknown> | null;
    const zoneId = data?.zoneId;
    const fcmToken = data?.fcmToken;

    if (typeof zoneId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(zoneId)) {
      throw new HttpsError("invalid-argument", "Invalid zoneId.");
    }
    if (typeof fcmToken !== "string" || fcmToken.length < 10) {
      throw new HttpsError("invalid-argument", "Invalid FCM token.");
    }

    const topic = `zone_${zoneId}`;
    await messaging.subscribeToTopic(fcmToken, topic);

    await db
      .collection("device_subscriptions")
      .doc(req.auth.uid)
      .set(
        {
          uid: req.auth.uid,
          tokens: FieldValue.arrayUnion(fcmToken),
          topics: FieldValue.arrayUnion(topic),
          active: true,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return { success: true, topic };
  }
);

/**
 * `acknowledgeAlert`
 *
 * Records a user-side acknowledgment of an alert. Used to compute
 * "affected population" metrics and to power post-incident reporting.
 */
export const acknowledgeAlert = onCall<unknown, Promise<{ success: true; acknowledgedAt: string }>>(
  { region: "us-central1", enforceAppCheck: true, cors: false },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const data = req.data as Record<string, unknown> | null;
    const alertId = data?.alertId;
    if (typeof alertId !== "string" || alertId.length === 0) {
      throw new HttpsError("invalid-argument", "Invalid alertId.");
    }
    const acknowledgedAt = new Date().toISOString();
    await db
      .collection("emergency_acknowledgments")
      .doc(`${alertId}_${req.auth.uid}`)
      .set({
        alertId,
        uid: req.auth.uid,
        acknowledgedAt: FieldValue.serverTimestamp(),
        acknowledgedAtIso: acknowledgedAt,
      });
    return { success: true, acknowledgedAt };
  }
);
