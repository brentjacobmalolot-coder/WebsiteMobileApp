/**
 * CampusAlert Pro — Android
 *
 * Emergency Repository.
 *
 * Acts as a single source of truth for emergency protocol data, coordinating
 * reads from the local Room database with background sync from Firestore.
 * Implements offline-first semantics: the UI always reads from the local DB,
 * while a coroutine worker refreshes data in the background when connectivity
 * is available.
 */

package com.campusalert.pro.domain.repository

import com.campusalert.pro.data.dao.EmergencyDao
import com.campusalert.pro.data.database.CampusDatabase
import com.campusalert.pro.data.entity.EmergencyProtocolEntity
import com.campusalert.pro.domain.model.EmergencyCategory
import com.campusalert.pro.domain.model.EmergencyProtocol
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository interface for emergency protocols.
 * Exposed to ViewModels via the DI graph.
 */
interface EmergencyRepository {

    /** Reactive stream of all active protocols, sorted by priority. */
    fun observeAllProtocols(): Flow<List<EmergencyProtocol>>

    /** Reactive stream of protocols for a specific zone. */
    fun observeProtocolsForZone(zoneId: String): Flow<List<EmergencyProtocol>>

    /** Reactive stream of protocols matching the given category. */
    fun observeProtocolsByCategory(category: EmergencyCategory): Flow<List<EmergencyProtocol>>

    /** Single-protocol observable lookup. */
    fun observeProtocol(protocolId: String): Flow<EmergencyProtocol?>

    /**
     * Triggers a one-shot background sync with Firestore, fetching any
     * protocols with a `lastUpdated` timestamp newer than the local maximum.
     * Does not block; errors are logged and swallowed to preserve offline UX.
     */
    suspend fun syncProtocols()

    /** Returns the count of locally cached active protocols. */
    suspend fun getLocalProtocolCount(): Int
}

/**
 * Production implementation of [EmergencyRepository].
 *
 * Thread-safety:
 *   - All Room reads/writes happen on [Dispatchers.IO].
 *   - The sync coroutine is launched in [SupervisorJob] so a failure in one
 *     sync cycle does not cancel the parent scope.
 *   - The [SharingStarted.WhileSubscribed] replay strategy ensures the UI
 *     always has a stale-but-populated list while fresh data loads.
 */
@Singleton
class EmergencyRepositoryImpl @Inject constructor(
    private val database: CampusDatabase,
    private val firestore: FirebaseFirestore,
    private val currentZoneId: () -> String,
) : EmergencyRepository {

    private val dao: EmergencyDao = database.emergencyDao()

    /**
     * Scope for background sync tasks. Using [SupervisorJob] ensures that a
     * failed Firestore query does not cancel pending or future sync attempts.
     */
    private val syncScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Lazily launched background sync. */
    private val syncJob = syncScope.launch { syncProtocols() }

    // -------------------------------------------------------------------------
    // Public observable API
    // -------------------------------------------------------------------------

    override fun observeAllProtocols(): Flow<List<EmergencyProtocol>> {
        return dao.observeAllActive()
            .map { entities -> entities.map(EmergencyProtocol::fromEntity) }
            .catch { emit(emptyList()) }
    }

    override fun observeProtocolsForZone(zoneId: String): Flow<List<EmergencyProtocol>> {
        return dao.observeForZone(zoneId)
            .map { entities -> entities.map(EmergencyProtocol::fromEntity) }
            .catch { emit(emptyList()) }
    }

    override fun observeProtocolsByCategory(category: EmergencyCategory): Flow<List<EmergencyProtocol>> {
        return dao.observeByCategory(category.name)
            .map { entities -> entities.map(EmergencyProtocol::fromEntity) }
            .catch { emit(emptyList()) }
    }

    override fun observeProtocol(protocolId: String): Flow<EmergencyProtocol?> {
        return dao.observeById(protocolId)
            .map { entity -> entity?.let(EmergencyProtocol::fromEntity) }
            .catch { emit(null) }
    }

    override suspend fun getLocalProtocolCount(): Int {
        return withContext(Dispatchers.IO) {
            dao.getActiveCount()
        }
    }

    // -------------------------------------------------------------------------
    // Background sync
    // -------------------------------------------------------------------------

    override suspend fun syncProtocols() {
        withContext(Dispatchers.IO) {
            try {
                val lastUpdated = dao.getLastUpdatedAt() ?: 0L

                val snapshot = firestore
                    .collection("emergency_protocols")
                    .whereEqualTo("isActive", true)
                    .whereGreaterThan("lastUpdated", lastUpdated)
                    .orderBy("lastUpdated", Query.Direction.ASCENDING)
                    .limit(100)
                    .get()
                    .await()

                if (snapshot.isEmpty) return@withContext

                val entities = snapshot.documents.mapNotNull { doc ->
                    try {
                        EmergencyProtocolEntity(
                            protocolId = doc.id,
                            category = doc.getString("category") ?: return@mapNotNull null,
                            title = doc.getString("title") ?: return@mapNotNull null,
                            instructionPayload = doc.getString("instructionPayload") ?: "[]",
                            version = doc.getLong("version")?.toInt() ?: 1,
                            lastUpdated = doc.getLong("lastUpdated") ?: System.currentTimeMillis(),
                            priority = doc.getLong("priority")?.toInt() ?: 0,
                            zoneId = doc.getString("zoneId") ?: "ALL",
                            isActive = doc.getBoolean("isActive") ?: true,
                            summary = doc.getString("summary") ?: "",
                            iconType = doc.getString("iconType") ?: "shield",
                        )
                    } catch (e: Exception) {
                        null
                    }
                }

                if (entities.isNotEmpty()) {
                    dao.upsertAll(entities)
                }
            } catch (e: Exception) {
                // Log and suppress — offline-first means we never surface sync
                // errors to the UI. The next connectivity window will retry.
                android.util.Log.w("EmergencyRepo", "Protocol sync failed", e)
            }
        }
    }
}
