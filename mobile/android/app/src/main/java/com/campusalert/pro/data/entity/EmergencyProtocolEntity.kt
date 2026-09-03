/**
 * CampusAlert Pro — Android
 *
 * Emergency Protocol Entity for the Room Database.
 * Represents a cached emergency protocol/playbook with encrypted local persistence.
 */

package com.campusalert.pro.data.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Represents a single emergency protocol (playbook) cached locally on the device.
 *
 * The `instructionPayload` field stores the full JSON instruction set as a
 * string — parsed lazily by the repository layer. The `lastUpdated` field
 * carries a server-side epoch millisecond timestamp used for incremental
 * synchronization, so the client never re-downloads unchanged protocols.
 *
 * Thread-safety note: all reads/writes to this table must go through the
 * [EmergencyDao] coroutine interface; direct multi-threaded access without
 * transaction boundaries will produce undefined results.
 *
 * @property protocolId Unique identifier matching the Firestore document ID.
 * @property category    Broad emergency category, e.g. "WEATHER", "LOCKDOWN", "EVACUATION".
 * @property title       Human-readable short title for display.
 * @property instructionPayload Raw JSON string containing step-by-step instructions,
 *                             routes, and resource links.
 * @property version     Optimistic-lock version counter incremented server-side on each change.
 * @property lastUpdated Server-side epoch milliseconds of the last meaningful change.
 * @property priority    Sorting priority; higher values surface first in the UI.
 * @property zoneId      Campus zone this protocol applies to, or "ALL" for global protocols.
 */
@Entity(
    tableName = "emergency_protocols",
    indices = [
        Index(value = ["category"]),
        Index(value = ["zoneId"]),
        Index(value = ["lastUpdated"]),
    ]
)
data class EmergencyProtocolEntity(

    @PrimaryKey
    @ColumnInfo(name = "protocol_id")
    val protocolId: String,

    @ColumnInfo(name = "category")
    val category: String,

    @ColumnInfo(name = "title")
    val title: String,

    @ColumnInfo(name = "instruction_payload", typeAffinity = ColumnInfo.TEXT)
    val instructionPayload: String,

    @ColumnInfo(name = "version")
    val version: Int,

    @ColumnInfo(name = "last_updated")
    val lastUpdated: Long,

    @ColumnInfo(name = "priority")
    val priority: Int,

    @ColumnInfo(name = "zone_id")
    val zoneId: String,

    @ColumnInfo(name = "is_active")
    val isActive: Boolean = true,

    @ColumnInfo(name = "summary")
    val summary: String = "",

    @ColumnInfo(name = "icon_type")
    val iconType: String = "shield",
)
