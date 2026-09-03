//
//  EmergencyProtocolEntity.swift
//  CampusAlertPro
//
//  CoreData entity for offline emergency protocol persistence.
//  Uses AES-256 encryption at rest via NSPersistentStoreFileProtectionKey.
//

import Foundation
import CoreData

/// Represents a single emergency protocol (playbook) cached on the device.
@objc(EmergencyProtocolEntity)
public class EmergencyProtocolEntity: NSManagedObject {

    @NSManaged public var protocolId: String
    @NSManaged public var category: String
    @NSManaged public var title: String
    @NSManaged public var summary: String
    @NSManaged public var instructionPayload: String
    @NSManaged public var version: Int32
    @NSManaged public var lastUpdated: Date
    @NSManaged public var priority: Int32
    @NSManaged public var zoneId: String
    @NSManaged public var isActive: Bool
    @NSManaged public var iconType: String

    /// Convenience initializer used during sync operations.
    @discardableResult
    public static func create(
        in context: NSManagedObjectContext,
        protocolId: String,
        category: String,
        title: String,
        summary: String = "",
        instructionPayload: String,
        version: Int = 1,
        lastUpdated: Date = Date(),
        priority: Int = 0,
        zoneId: String = "ALL",
        isActive: Bool = true,
        iconType: String = "shield"
    ) -> EmergencyProtocolEntity {
        let entity = EmergencyProtocolEntity(context: context)
        entity.protocolId = protocolId
        entity.category = category
        entity.title = title
        entity.summary = summary
        entity.instructionPayload = instructionPayload
        entity.version = Int32(version)
        entity.lastUpdated = lastUpdated
        entity.priority = Int32(priority)
        entity.zoneId = zoneId
        entity.isActive = isActive
        entity.iconType = iconType
        return entity
    }
}

/// NonManagedObjectType for emergency protocol category.
public enum EmergencyCategory: String, CaseIterable, Identifiable {
    case weather = "WEATHER"
    case lockdown = "LOCKDOWN"
    case evacuation = "EVACUATION"
    case medical = "MEDICAL"
    case fire = "FIRE"
    case hazmat = "HAZMAT"
    case earthquake = "EARTHQUAKE"
    case infrastructure = "INFRASTRUCTURE"
    case unknown = "UNKNOWN"

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .weather: return "Severe Weather"
        case .lockdown: return "Active Threat"
        case .evacuation: return "Evacuation"
        case .medical: return "Medical Emergency"
        case .fire: return "Fire Emergency"
        case .hazmat: return "Hazardous Material"
        case .earthquake: return "Earthquake"
        case .infrastructure: return "Infrastructure Failure"
        case .unknown: return "General Alert"
        }
    }

    public var iconSystemName: String {
        switch self {
        case .weather: return "cloud.bolt.rain.fill"
        case .lockdown: return "lock.shield.fill"
        case .evacuation: return "figure.run"
        case .medical: return "cross.case.fill"
        case .fire: return "flame.fill"
        case .hazmat: return "biohazard"
        case .earthquake: return "wave.3.right"
        case .infrastructure: return "wrench.and.screwdriver.fill"
        case .unknown: return "exclamationmark.shield.fill"
        }
    }
}
