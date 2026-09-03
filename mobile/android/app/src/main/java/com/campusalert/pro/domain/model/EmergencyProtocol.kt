/**
 * CampusAlert Pro — Android
 *
 * Domain model representing an emergency protocol (playbook).
 * This is the canonical business object, decoupled from the persistence layer.
 */

package com.campusalert.pro.domain.model

import com.campusalert.pro.data.entity.EmergencyProtocolEntity

/**
 * Represents the severity level of an emergency alert.
 */
enum class AlertSeverity {
    LOW,
    MEDIUM,
    CRITICAL;

    companion object {
        fun fromString(value: String): AlertSeverity {
            return entries.find { it.name == value.uppercase() } ?: LOW
        }
    }
}

/**
 * Domain model for an emergency protocol / playbook.
 * Instances of this class are constructed by the repository layer from
 * [EmergencyProtocolEntity] database records, and are the type exposed
 * to the UI via [StateFlow].
 */
data class EmergencyProtocol(
    val id: String,
    val category: EmergencyCategory,
    val title: String,
    val summary: String,
    val instructionSteps: List<InstructionStep>,
    val version: Int,
    val lastUpdated: Long,
    val priority: Int,
    val zoneId: String,
    val isActive: Boolean,
    val iconType: String,
) {

    /**
     * Represents a single instruction step within a protocol.
     */
    data class InstructionStep(
        val order: Int,
        val heading: String,
        val body: String,
        val iconType: String?,
        val isCritical: Boolean,
    )

    companion object {
        private val _categoryCache = mutableMapOf<String, EmergencyCategory>()

        /** Maps an [EmergencyProtocolEntity] to this domain model. */
        fun fromEntity(entity: EmergencyProtocolEntity): EmergencyProtocol {
            return EmergencyProtocol(
                id = entity.protocolId,
                category = _categoryCache.getOrPut(entity.category) {
                    EmergencyCategory.fromString(entity.category)
                },
                title = entity.title,
                summary = entity.summary,
                instructionSteps = parseInstructions(entity.instructionPayload),
                version = entity.version,
                lastUpdated = entity.lastUpdated,
                priority = entity.priority,
                zoneId = entity.zoneId,
                isActive = entity.isActive,
                iconType = entity.iconType,
            )
        }

        private fun parseInstructions(json: String): List<InstructionStep> {
            if (json.isBlank()) return emptyList()
            return try {
                val steps = mutableListOf<InstructionStep>()
                val regex = Regex(
                    """\{"order"\s*:\s*(\d+)\s*,\s*"heading"\s*:\s*"([^"]*)"\s*,\s*"body"\s*:\s*"([^"]*)"(?:,\s*"iconType"\s*:\s*"([^"]*)")?(?:,\s*"isCritical"\s*:\s*(true|false))?}""",
                    RegexOption.IGNORE_CASE
                )
                regex.findAll(json).forEach { match ->
                    steps.add(
                        InstructionStep(
                            order = match.groupValues[1].toIntOrNull() ?: 0,
                            heading = match.groupValues[2].unescape(),
                            body = match.groupValues[3].unescape(),
                            iconType = match.groupValues[4].takeIf { it.isNotBlank() },
                            isCritical = match.groupValues[5].equals("true", ignoreCase = true),
                        )
                    )
                }
                steps.sortedBy { it.order }
            } catch (e: Exception) {
                emptyList()
            }
        }

        private fun String.unescape(): String {
            return this
                .replace("\\n", "\n")
                .replace("\\\"", "\"")
                .replace("\\\\", "\\")
                .replace("\\/", "/")
        }
    }
}

/**
 * Broad emergency category taxonomy.
 */
enum class EmergencyCategory(val displayName: String, val iconName: String) {
    WEATHER("Severe Weather", "cloud"),
    LOCKDOWN("Active Threat", "alert"),
    EVACUATION("Evacuation", "run"),
    MEDICAL("Medical Emergency", "medkit"),
    FIRE("Fire Emergency", "flame"),
    HAZMAT("Hazardous Material", "biohazard"),
    EARTHQUAKE("Earthquake", "magnet"),
    INFRASTRUCTURE("Infrastructure Failure", "construct"),
    UNKNOWN("General Alert", "info");

    companion object {
        fun fromString(value: String): EmergencyCategory {
            return entries.find {
                it.name.equals(value, ignoreCase = true) ||
                it.displayName.equals(value, ignoreCase = true)
            } ?: UNKNOWN
        }
    }
}

/**
 * Represents the current state of an emergency alert received via FCM.
 */
data class EmergencyAlert(
    val alertId: String,
    val title: String,
    val body: String,
    val severity: AlertSeverity,
    val zoneId: String,
    val category: EmergencyCategory,
    val deepLink: String?,
    val receivedAt: Long = System.currentTimeMillis(),
    val expiresAt: Long? = null,
    val acknowledged: Boolean = false,
)
