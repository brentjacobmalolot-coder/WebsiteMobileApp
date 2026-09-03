//
//  PersistentController.swift
//  CampusAlertPro
//
//  Thread-safe CoreData stack with AES-256 file protection.
//

import Foundation
import CoreData
import os.log

/// Application-wide CoreData coordinator.
/// Thread-safety: all context creation goes through the factory methods below,
/// which guarantee the main-queue context and a shared background worker.
public final class PersistentController {

    public static let shared = PersistentController()

    /// Tag for os_log entries from this class.
    private let logger = Logger(subsystem: "com.campusalert.pro", category: "Persistence")

    /// The managed object model, constructed programmatically for version control.
    private let model: NSManagedObjectModel

    /// The persistent store coordinator with encryption configuration.
    private let coordinator: NSPersistentStoreCoordinator

    /// Main-thread view context for UI reads.
    public let viewContext: NSManagedObjectContext

    private init() {
        // Programmatically define the NSManagedObjectModel so we have version-controlled
        // schema evolution and don't need a .xcdatamodeld bundle.
        let entity = NSEntityDescription()
        entity.name = "EmergencyProtocolEntity"
        entity.managedObjectClassName = "EmergencyProtocolEntity"

        let protocolId = NSAttributeDescription()
        protocolId.name = "protocolId"
        protocolId.attributeType = .stringAttributeType
        protocolId.isOptional = false

        let category = NSAttributeDescription()
        category.name = "category"
        category.attributeType = .stringAttributeType
        category.isOptional = false

        let title = NSAttributeDescription()
        title.name = "title"
        title.attributeType = .stringAttributeType
        title.isOptional = false

        let summary = NSAttributeDescription()
        summary.name = "summary"
        summary.attributeType = .stringAttributeType
        summary.isOptional = false
        summary.defaultValue = ""

        let instructionPayload = NSAttributeDescription()
        instructionPayload.name = "instructionPayload"
        instructionPayload.attributeType = .stringAttributeType
        instructionPayload.isOptional = false

        let version = NSAttributeDescription()
        version.name = "version"
        version.attributeType = .integer32AttributeType
        version.isOptional = false
        version.defaultValue = 1

        let lastUpdated = NSAttributeDescription()
        lastUpdated.name = "lastUpdated"
        lastUpdated.attributeType = .dateAttributeType
        lastUpdated.isOptional = false

        let priority = NSAttributeDescription()
        priority.name = "priority"
        priority.attributeType = .integer32AttributeType
        priority.isOptional = false
        priority.defaultValue = 0

        let zoneId = NSAttributeDescription()
        zoneId.name = "zoneId"
        zoneId.attributeType = .stringAttributeType
        zoneId.isOptional = false
        zoneId.defaultValue = "ALL"

        let isActive = NSAttributeDescription()
        isActive.name = "isActive"
        isActive.attributeType = .booleanAttributeType
        isActive.isOptional = false
        isActive.defaultValue = true

        let iconType = NSAttributeDescription()
        iconType.name = "iconType"
        iconType.attributeType = .stringAttributeType
        iconType.isOptional = false
        iconType.defaultValue = "shield"

        entity.properties = [
            protocolId, category, title, summary,
            instructionPayload, version, lastUpdated,
            priority, zoneId, isActive, iconType
        ]

        let indexProtocolId = NSFetchIndexElementDescription(property: protocolId, collationType: .binary)
        let indexCategory = NSFetchIndexElementDescription(property: category, collationType: .binary)
        let indexZoneId = NSFetchIndexElementDescription(property: zoneId, collationType: .binary)
        let indexLastUpdated = NSFetchIndexElementDescription(property: lastUpdated, collationType: .binary)

        let indexDescription = NSFetchIndexDescription(name: "idx_protocols", elements: [
            indexProtocolId, indexCategory, indexZoneId, indexLastUpdated
        ])
        entity.indexes = [indexDescription]

        model = NSManagedObjectModel()
        model.entities = [entity]

        coordinator = NSPersistentStoreCoordinator(managedObjectModel: model)

        // Configure file protection: complete AES-256 encryption at rest.
        let storeDescription = NSPersistentStoreDescription()
        storeDescription.url = Self.storeURL
        storeDescription.setOption(
            FileProtectionType.complete as NSObject,
            forKey: NSPersistentStoreFileProtectionKey
        )
        storeDescription.shouldMigrateStoreAutomatically = true
        storeDescription.shouldInferMappingModelAutomatically = true

        do {
            try coordinator.addPersistentStore(
                ofType: NSSQLiteStoreType,
                configurationName: nil,
                storeDescription: storeDescription
            )
            logger.info("Persistent store opened at \(Self.storeURL.path)")
        } catch {
            logger.error("Failed to open persistent store: \(error.localizedDescription)")
            fatalError("PersistentController: \(error)")
        }

        viewContext = NSManagedObjectContext(.mainQueue)
        viewContext.automaticallyMergesChangesFromParent = true
        viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
        viewContext.name = "viewContext"
    }

    private static var storeURL: URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let appFolder = appSupport.appendingPathComponent("CampusAlertPro", isDirectory: true)
        try? FileManager.default.createDirectory(at: appFolder, withIntermediateDirectories: true)
        return appFolder.appendingPathComponent("CampusAlertPro.sqlite")
    }

    /// Creates a new background context for sync and write operations.
    /// - Warning: Background contexts must not be used for UI reads.
    public func newBackgroundContext() -> NSManagedObjectContext {
        let ctx = NSManagedObjectContext(.privateQueueQueue)
        ctx.parent = viewContext
        ctx.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
        ctx.name = "backgroundContext-\(UUID().uuidString.prefix(8))"
        return ctx
    }

    /// Performs a background write operation safely.
    public func performBackgroundTask(_ block: @escaping (NSManagedObjectContext) -> Void) {
        let ctx = newBackgroundContext()
        ctx.perform {
            block(ctx)
            if ctx.hasChanges {
                do {
                    try ctx.save()
                    self.viewContext.perform {
                        self.viewContext.refreshAllObjects()
                    }
                } catch {
                    self.logger.error("Background save failed: \(error.localizedDescription)")
                }
            }
        }
    }
}
