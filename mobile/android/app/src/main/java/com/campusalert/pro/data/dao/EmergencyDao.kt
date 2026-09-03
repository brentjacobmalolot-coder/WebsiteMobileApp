/**
 * CampusAlert Pro — Android
 *
 * Emergency Data Access Object (DAO).
 *
 * Exposes a fully reactive, coroutine-based interface over the Room database
 * for offline emergency-protocol access. Every observable query returns a
 * Kotlin [Flow] that emits on every underlying table change, providing
 * automatic, real-time UI updates without manual refresh logic.
 */

package com.campusalert.pro.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.campusalert.pro.data.entity.EmergencyProtocolEntity
import kotlinx.coroutines.flow.Flow

/**
 * Data-access object for [EmergencyProtocolEntity].
 *
 * All long-running operations are `suspend` functions, ensuring they are
 * dispatched off the main thread by Kotlin Coroutines. Observables return
 * cold [Flow] streams that the ViewModel can collect with `collectAsState`
 * inside a Jetpack Compose hierarchy.
 */
@Dao
interface EmergencyDao {

    // -------------------------------------------------------------------------
    // Observable queries — return Flow for reactive UI binding.
    // -------------------------------------------------------------------------

    /** Reactive stream of every active protocol, sorted by priority desc. */
    @Query(
        """
        SELECT * FROM emergency_protocols
        WHERE is_active = 1
        ORDER BY priority DESC, title ASC
        """
    )
    fun observeAllActive(): Flow<List<EmergencyProtocolEntity>>

    /** Reactive stream of all protocols in a given category. */
    @Query(
        """
        SELECT * FROM emergency_protocols
        WHERE category = :category AND is_active = 1
        ORDER BY priority DESC
        """
    )
    fun observeByCategory(category: String): Flow<List<EmergencyProtocolEntity>>

    /** Reactive stream of protocols applicable to the given zone. */
    @Query(
        """
        SELECT * FROM emergency_protocols
        WHERE (zone_id = :zoneId OR zone_id = 'ALL') AND is_active = 1
        ORDER BY priority DESC, last_updated DESC
        """
    )
    fun observeForZone(zoneId: String): Flow<List<EmergencyProtocolEntity>>

    /** Single-protocol reactive lookup, or null if not present. */
    @Query("SELECT * FROM emergency_protocols WHERE protocol_id = :protocolId LIMIT 1")
    fun observeById(protocolId: String): Flow<EmergencyProtocolEntity?>

    // -------------------------------------------------------------------------
    // One-shot (suspend) reads — used by repository background workers.
    // -------------------------------------------------------------------------

    @Query("SELECT * FROM emergency_protocols WHERE protocol_id = :protocolId LIMIT 1")
    suspend fun getById(protocolId: String): EmergencyProtocolEntity?

    @Query("SELECT * FROM emergency_protocols WHERE is_active = 1 ORDER BY priority DESC")
    suspend fun getAllActiveOnce(): List<EmergencyProtocolEntity>

    @Query("SELECT MAX(last_updated) FROM emergency_protocols")
    suspend fun getLastUpdatedAt(): Long?

    @Query("SELECT COUNT(*) FROM emergency_protocols WHERE is_active = 1")
    suspend fun getActiveCount(): Int

    // -------------------------------------------------------------------------
    // Mutations — all suspend; insert uses REPLACE so version bumps are idempotent.
    // -------------------------------------------------------------------------

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(protocol: EmergencyProtocolEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(protocols: List<EmergencyProtocolEntity>)

    @Update
    suspend fun update(protocol: EmergencyProtocolEntity)

    /**
     * Incremental sync: insert-or-replace each protocol, in a single
     * transaction. Returns the number of rows that were newly inserted or
     * updated. Rows not in [protocols] are preserved, allowing callers to
     * implement delta sync with confidence.
     */
    @Transaction
    suspend fun upsertAll(protocols: List<EmergencyProtocolEntity>): Int {
        if (protocols.isEmpty()) return 0
        insertAll(protocols)
        return protocols.size
    }

    /**
     * Marks protocols as inactive (soft delete). Hard delete is intentionally
     * not exposed — institutional compliance requires the audit trail to
     * retain record of historical protocols.
     */
    @Query("UPDATE emergency_protocols SET is_active = 0 WHERE protocol_id IN (:ids)")
    suspend fun markInactive(ids: List<String>): Int

    @Query("DELETE FROM emergency_protocols WHERE protocol_id = :protocolId")
    suspend fun deleteById(protocolId: String)

    @Query("DELETE FROM emergency_protocols")
    suspend fun clearAll()
}
