//
//  EmergencyRepository.swift
//  CampusAlertPro
//
//  Repository implementing offline-first sync with Firestore.
//

import Foundation
import CoreData
import Combine
import FirebaseFirestore

/// Domain model representing a parsed emergency protocol.
struct EmergencyProtocol: Identifiable, Equatable {
    let id: String
    let category: EmergencyCategory
    let title: String
    let summary: String
    let instructionSteps: [InstructionStep]
    let version: Int
    let lastUpdated: Date
    let priority: Int
    let zoneId: String
    let isActive: Bool
    let iconType: String

    struct InstructionStep: Equatable {
        let order: Int
        let heading: String
        let body: String
        let iconType: String?
        let isCritical: Bool
    }
}

/// Repository protocol for testability.
protocol EmergencyRepositoryProtocol {
    var allProtocolsPublisher: AnyPublisher<[EmergencyProtocol], Never> { get }
    func syncProtocols() async throws
    func getLocalProtocolCount() async -> Int
}

/// Production repository: coordinates CoreData reads with Firestore sync.
final class EmergencyRepository: ObservableObject, EmergencyRepositoryProtocol {

    static let shared = EmergencyRepository()

    private let persistence = PersistentController.shared
    private let db = Firestore.firestore()
    private let logger = Logger(subsystem: "com.campusalert.pro", category: "Repository")

    /// Publishes the full list of active protocols, updated whenever the CoreData context changes.
    @Published private(set) var protocols: [EmergencyProtocol] = []

    var allProtocolsPublisher: AnyPublisher<[EmergencyProtocol], Never> {
        $protocols.eraseToAnyPublisher()
    }

    init() {
        loadFromLocalStore()
        setupContextObserver()
    }

    // MARK: - Local Reads

    private func loadFromLocalStore() {
        let ctx = persistence.viewContext
        let request = NSFetchRequest<EmergencyProtocolEntity>(entityName: "EmergencyProtocolEntity")
        request.predicate = NSPredicate(format: "isActive == YES")
        request.sortDescriptors = [
            NSSortDescriptor(key: "priority", ascending: false),
            NSSortDescriptor(key: "title", ascending: true),
        ]

        do {
            let entities = try ctx.fetch(request)
            protocols = entities.map(Self.mapEntityToDomain)
        } catch {
            logger.error("Failed to fetch protocols: \(error.localizedDescription)")
            protocols = []
        }
    }

    private func setupContextObserver() {
        NotificationCenter.default.addObserver(
            forName: .NSManagedObjectContextObjectsDidChange,
            object: persistence.viewContext,
            queue: .main
        ) { [weak self] _ in
            self?.loadFromLocalStore()
        }
    }

    // MARK: - Sync

    func syncProtocols() async throws {
        let lastUpdated = getLastUpdatedTimestamp()

        let snapshot = try await db
            .collection("emergency_protocols")
            .whereField("isActive", isEqualTo: true)
            .whereField("lastUpdated", isGreaterThan: lastUpdated)
            .order(by: "lastUpdated", descending: false)
            .limit(to: 100)
            .getDocuments()

        guard !snapshot.isEmpty else { return }

        persistence.performBackgroundTask { context in
            for doc in snapshot.documents {
                let data = doc.data()
                let protocolId = doc.documentID
                let existingRequest = NSFetchRequest<EmergencyProtocolEntity>(
                    entityName: "EmergencyProtocolEntity"
                )
                existingRequest.predicate = NSPredicate(format: "protocolId == %@", protocolId)
                existingRequest.fetchLimit = 1

                let existing = try? context.fetch(existingRequest).first
                let entity = existing ?? EmergencyProtocolEntity(context: context)

                entity.protocolId = protocolId
                entity.category = data["category"] as? String ?? "UNKNOWN"
                entity.title = data["title"] as? String ?? ""
                entity.summary = data["summary"] as? String ?? ""
                entity.instructionPayload = data["instructionPayload"] as? String ?? "[]"
                entity.version = Int32(data["version"] as? Int ?? 1)
                entity.lastUpdated = Date(timeIntervalSince1970: (data["lastUpdated"] as? Double ?? 0) / 1000)
                entity.priority = Int32(data["priority"] as? Int ?? 0)
                entity.zoneId = data["zoneId"] as? String ?? "ALL"
                entity.isActive = data["isActive"] as? Bool ?? true
                entity.iconType = data["iconType"] as? String ?? "shield"
            }
        }
    }

    private func getLastUpdatedTimestamp() -> Double {
        let ctx = persistence.viewContext
        let request = NSFetchRequest<NSDictionary>(entityName: "EmergencyProtocolEntity")
        request.resultType = .dictionaryResultType
        let maxExpr = NSExpressionDescription()
        maxExpr.name = "maxLastUpdated"
        maxExpr.expression = NSExpression(
            forFunction: "max:",
            arguments: [NSExpression(forKeyPath: "lastUpdated")]
        )
        request.propertiesToFetch = [maxExpr]

        if let result = try? ctx.fetch(request).first,
           let maxDate = result["maxLastUpdated"] as? Date {
            return maxDate.timeIntervalSince1970 * 1000
        }
        return 0
    }

    func getLocalProtocolCount() async -> Int {
        let ctx = persistence.viewContext
        let request = NSFetchRequest<EmergencyProtocolEntity>(entityName: "EmergencyProtocolEntity")
        request.predicate = NSPredicate(format: "isActive == YES")
        return (try? ctx.count(for: request)) ?? 0
    }

    // MARK: - Mapping

    private static func mapEntityToDomain(_ entity: EmergencyProtocolEntity) -> EmergencyProtocol {
        EmergencyProtocol(
            id: entity.protocolId,
            category: EmergencyCategory(rawValue: entity.category) ?? .unknown,
            title: entity.title,
            summary: entity.summary,
            instructionSteps: parseInstructionSteps(entity.instructionPayload),
            version: Int(entity.version),
            lastUpdated: entity.lastUpdated,
            priority: Int(entity.priority),
            zoneId: entity.zoneId,
            isActive: entity.isActive,
            iconType: entity.iconType
        )
    }

    private static func parseInstructionSteps(_ json: String) -> [EmergencyProtocol.InstructionStep] {
        guard let data = json.data(using: .utf8),
              let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }
        return array.compactMap { dict in
            guard let order = dict["order"] as? Int,
                  let heading = dict["heading"] as? String,
                  let body = dict["body"] as? String else { return nil }
            return EmergencyProtocol.InstructionStep(
                order: order,
                heading: heading,
                body: body,
                iconType: dict["iconType"] as? String,
                isCritical: dict["isCritical"] as? Bool ?? false
            )
        }.sorted { $0.order < $1.order }
    }
}
