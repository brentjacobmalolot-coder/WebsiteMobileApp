/**
 * CampusAlert Pro — Android
 *
 * Hilt Dependency Injection module.
 */

package com.campusalert.pro.di

import android.content.Context
import com.campusalert.pro.data.database.CampusDatabase
import com.campusalert.pro.domain.repository.EmergencyRepository
import com.campusalert.pro.domain.repository.EmergencyRepositoryImpl
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.MutexKt
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideCampusDatabase(
        @ApplicationContext context: Context,
    ): CampusDatabase {
        return CampusDatabase.getInstance(context)
    }

    @Provides
    @Singleton
    fun provideEmergencyDao(database: CampusDatabase) = database.emergencyDao()

    @Provides
    @Singleton
    fun provideFirestore(): FirebaseFirestore {
        return FirebaseFirestore.getInstance().apply {
            // Enable offline persistence for Firestore reads.
            firestoreSettings = com.google.firebase.firestore.FirebaseFirestoreSettings.Builder()
                .setPersistenceEnabled(true)
                .build()
        }
    }

    @Provides
    @Singleton
    fun provideFirebaseAuth(): FirebaseAuth {
        return FirebaseAuth.getInstance()
    }

    @Provides
    @Singleton
    fun provideCurrentZoneIdProvider(): () -> String {
        // In production, this would be derived from the user's enrolled zone
        // via Firebase Auth custom claims or a Firestore user document.
        return { "ALL" }
    }

    @Provides
    @Singleton
    fun provideEmergencyRepository(
        database: CampusDatabase,
        firestore: FirebaseFirestore,
        currentZoneId: () -> String,
    ): EmergencyRepository {
        return EmergencyRepositoryImpl(database, firestore, currentZoneId)
    }
}
