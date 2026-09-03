//
//  AppDelegate.swift
//  CampusAlertPro
//
//  Firebase and FCM initialization.
//

import UIKit
import FirebaseCore
import FirebaseMessaging
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // Initialize Firebase.
        FirebaseApp.configure()

        // Register for remote notifications.
        UNUserNotificationCenter.current().delegate = self
        let authOptions: UNAuthorizationOptions = [.alert, .sound, .badge, .criticalAlert]
        UNUserNotificationCenter.current().requestAuthorization(options: authOptions) { granted, error in
            if let error = error {
                print("Notification auth error: \(error.localizedDescription)")
            }
            print("Notification auth granted: \(granted)")
        }
        application.registerForRemoteNotifications()

        // Configure FCM.
        Messaging.messaging().delegate = self

        return true
    }

    // MARK: UISceneSession Lifecycle

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    // MARK: - Token Management

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Messaging.messaging().apnsToken = deviceToken
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("Failed to register for remote notifications: \(error.localizedDescription)")
    }
}

// MARK: - MessagingDelegate

extension AppDelegate: MessagingDelegate {

    func messaging(
        _ messaging: Messaging,
        didReceiveRegistrationToken fcmToken: String?
    ) {
        guard let token = fcmToken else { return }
        print("FCM token received: \(token)")

        // Persist the token to Firestore under the user's subscription record.
        if let uid = Auth.auth().currentUser?.uid {
            let db = Firestore.firestore()
            db.collection("device_subscriptions").document(uid).setData([
                "tokens": FieldValue.arrayUnion([token]),
                "updatedAt": FieldValue.serverTimestamp(),
            ], merge: true) { error in
                if let error = error {
                    print("Failed to persist FCM token: \(error.localizedDescription)")
                }
            }
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension AppDelegate: UNUserNotificationCenterDelegate {

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Present notification even when the app is in the foreground.
        completionHandler([.banner, .sound, .badge])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        // Handle the notification action.
        if let alertId = userInfo["alertId"] as? String {
            print("User acknowledged alert: \(alertId)")

            // Send acknowledgment to the backend callable function.
            if let uid = Auth.auth().currentUser?.uid {
                let db = Firestore.firestore()
                db.collection("emergency_acknowledgments")
                    .document("\(alertId)_\(uid)")
                    .setData([
                        "alertId": alertId,
                        "uid": uid,
                        "acknowledgedAt": FieldValue.serverTimestamp(),
                    ])
            }
        }

        completionHandler()
    }
}
