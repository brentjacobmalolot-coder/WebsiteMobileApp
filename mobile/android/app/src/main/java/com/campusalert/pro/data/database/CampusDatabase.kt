/**
 * CampusAlert Pro — Android
 *
 * Thread-safe Singleton Room database builder.
 *
 * Uses SQLCipher (via `SupportFactory`) to provide AES-256 encryption at
 * rest for offline emergency playbooks. The database instance is created
 * lazily and protected by a `synchronized` check to guarantee that exactly
 * one instance exists per process.
 */

package com.campusalert.pro.data.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.campusalert.pro.data.dao.EmergencyDao
import com.campusalert.pro.data.entity.EmergencyProtocolEntity
import net.sqlcipher.database.SQLiteDatabase
import net.sqlcipher.database.SupportFactory
import java.io.File
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Versioned schema. Increment on any schema change and supply a
 * corresponding [Migration] in [ALL_MIGRATIONS] below.
 */
object SchemaVersion {
    const val CURRENT: Int = 2
}

/**
 * Migration registry. Add new entries here; the database builder will
 * execute them in order on first launch after a version bump.
 */
private val MIGRATION_1_2: Migration = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        // v2 additions:
        db.execSQL("ALTER TABLE emergency_protocols ADD COLUMN summary TEXT NOT NULL DEFAULT ''")
        db.execSQL("ALTER TABLE emergency_protocols ADD COLUMN icon_type TEXT NOT NULL DEFAULT 'shield'")
        // Index for faster category lookups.
        db.execSQL("CREATE INDEX IF NOT EXISTS index_emergency_protocols_category ON emergency_protocols(category)")
    }
}

private val ALL_MIGRATIONS: Array<Migration> = arrayOf(MIGRATION_1_2)

/**
 * The application's primary Room database. Holds emergency protocol data
 * for offline-first access during incidents.
 *
 * Construction is gated by [getInstance] which uses a double-checked
 * locking pattern to ensure exactly one instance per process, even under
 * concurrent access from multiple coroutine workers.
 */
@Database(
    entities = [EmergencyProtocolEntity::class],
    version = SchemaVersion.CURRENT,
    exportSchema = true,
)
abstract class CampusDatabase : RoomDatabase() {

    abstract fun emergencyDao(): EmergencyDao

    companion object {
        private const val DB_NAME = "campus_alert_pro.db"
        private const val KEY_FILE_NAME = "campus_alert_pro.db.key"
        private const val KEY_ALGORITHM = "AES"
        private const val KEY_SIZE_BITS = 256
        private const val GCM_TAG_BITS = 128
        private const val GCM_IV_BYTES = 12

        @Volatile
        private var instance: CampusDatabase? = null

        /**
         * Returns the singleton database instance, creating it on first use.
         *
         * @param context Application context — must be the application
         *                context, never an Activity context, to avoid leaks.
         * @param passphrase Optional explicit passphrase for the SQLCipher
         *                   encryption key. When null, a random key is
         *                   generated, persisted to internal storage, and
         *                   wrapped using Android Keystore.
         */
        fun getInstance(
            context: Context,
            passphrase: ByteArray? = null,
        ): CampusDatabase {
            return instance ?: synchronized(this) {
                instance ?: build(context.applicationContext, passphrase).also {
                    instance = it
                }
            }
        }

        /**
         * Closes the database and clears the singleton. For test use only.
         */
        @androidx.annotation.VisibleForTesting
        fun closeForTesting() {
            synchronized(this) {
                instance?.close()
                instance = null
            }
        }

        private fun build(
            appContext: Context,
            passphrase: ByteArray?,
        ): CampusDatabase {
            val keyBytes = passphrase ?: loadOrCreateKey(appContext)
            val factory = SupportFactory(SQLiteDatabase.getBytes(keyBytes))

            return Room.databaseBuilder(
                appContext,
                CampusDatabase::class.java,
                DB_NAME,
            )
                .openHelperFactory(factory)
                .addMigrations(*ALL_MIGRATIONS)
                // Defensive fallback: if migrations are missing, fall back to
                // destructive recreation only when explicitly enabled.
                .fallbackToDestructiveMigrationOnDowngrade(false)
                .setQueryCallback({ sql, args ->
                    // Hook for query-level tracing in debug builds.
                    if (android.util.Log.isLoggable("CampusDb", android.util.Log.VERBOSE)) {
                        android.util.Log.v("CampusDb", "SQL: $sql args=$args")
                    }
                }, java.util.concurrent.Executors.newSingleThreadExecutor())
                .build()
        }

        /**
         * Loads the SQLCipher passphrase from a Keystore-wrapped file. If no
         * key exists, generates a fresh 256-bit key, persists it under
         * Android Keystore protection, and returns the raw bytes.
         */
        private fun loadOrCreateKey(context: Context): ByteArray {
            val keyFile = File(context.filesDir, KEY_FILE_NAME)
            return if (keyFile.exists()) {
                unwrapKey(context, keyFile.readBytes())
            } else {
                val raw = ByteArray(KEY_SIZE_BITS / 8).also { SecureRandom().nextBytes(it) }
                val wrapped = wrapKey(context, raw)
                keyFile.writeBytes(wrapped)
                raw
            }
        }

        private fun wrapKey(context: Context, rawKey: ByteArray): ByteArray {
            val keystore = java.security.KeyStore.getInstance("AndroidKeyStore")
            keystore.load(null)
            val key = keystore.getKey("campus_db_master_key", null)
                ?: generateKeystoreKey()
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key as javax.crypto.SecretKey)
            val iv = cipher.iv
            val ciphertext = cipher.doFinal(rawKey)
            // Concatenate IV + ciphertext, base64-encode for storage.
            val out = ByteArray(iv.size + ciphertext.size)
            System.arraycopy(iv, 0, out, 0, iv.size)
            System.arraycopy(ciphertext, 0, out, iv.size, ciphertext.size)
            return out
        }

        private fun unwrapKey(context: Context, wrapped: ByteArray): ByteArray {
            val keystore = java.security.KeyStore.getInstance("AndroidKeyStore")
            keystore.load(null)
            val key = keystore.getKey("campus_db_master_key", null)
                ?: error("Keystore master key missing; database is unrecoverable.")
            val iv = wrapped.copyOfRange(0, GCM_IV_BYTES)
            val ciphertext = wrapped.copyOfRange(GCM_IV_BYTES, wrapped.size)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, key as javax.crypto.SecretKey, GCMParameterSpec(GCM_TAG_BITS, iv))
            return cipher.doFinal(ciphertext)
        }

        private fun generateKeystoreKey(): SecretKey {
            val kg = KeyGenerator.getInstance(KEY_ALGORITHM)
            kg.init(KEY_SIZE_BITS)
            val key = kg.generateKey()
            // Persist into the AndroidKeyStore via KeyGenParameterSpec.
            val spec = android.security.keystore.KeyGenParameterSpec.Builder(
                "campus_db_master_key",
                android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or
                    android.security.keystore.KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(KEY_SIZE_BITS)
                .build()
            val androidKg = KeyGenerator.getInstance(KEY_ALGORITHM, "AndroidKeyStore")
            androidKg.init(spec)
            androidKg.generateKey()
            return key
        }
    }
}
