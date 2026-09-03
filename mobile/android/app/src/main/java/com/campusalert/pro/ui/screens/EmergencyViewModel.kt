/**
 * CampusAlert Pro — Android
 *
 * Emergency ViewModel.
 * Manages UI state for the emergency protocols screen using Jetpack Compose
 * State + Kotlin Flow.
 */

package com.campusalert.pro.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.campusalert.pro.domain.model.EmergencyCategory
import com.campusalert.pro.domain.model.EmergencyProtocol
import com.campusalert.pro.domain.repository.EmergencyRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Screen-level UI state for the Emergency Protocols screen.
 */
data class EmergencyUiState(
    val protocols: List<EmergencyProtocol> = emptyList(),
    val selectedCategory: EmergencyCategory? = null,
    val selectedProtocol: EmergencyProtocol? = null,
    val isLoading: Boolean = true,
    val isSyncing: Boolean = false,
    val syncError: String? = null,
    val searchQuery: String = "",
) {
    val filteredProtocols: List<EmergencyProtocol>
        get() = protocols
            .filter { p -> selectedCategory == null || p.category == selectedCategory }
            .filter { p -> searchQuery.isBlank() || p.title.contains(searchQuery, ignoreCase = true) }
}

/**
 * Events emitted from the UI and consumed by the ViewModel.
 */
sealed class EmergencyEvent {
    data class SelectCategory(val category: EmergencyCategory?) : EmergencyEvent()
    data class SelectProtocol(val protocol: EmergencyProtocol?) : EmergencyEvent()
    data class Search(val query: String) : EmergencyEvent()
    data object Refresh : EmergencyEvent()
    data object DismissError : EmergencyEvent()
}

@HiltViewModel
class EmergencyViewModel @Inject constructor(
    private val repository: EmergencyRepository,
) : ViewModel() {

    private val _selectedCategory = MutableStateFlow<EmergencyCategory?>(null)
    private val _selectedProtocol = MutableStateFlow<EmergencyProtocol?>(null)
    private val _searchQuery = MutableStateFlow("")
    private val _isSyncing = MutableStateFlow(false)
    private val _syncError = MutableStateFlow<String?>(null)
    private val _isLoading = MutableStateFlow(true)

    /** Composes the final immutable UI state from all individual StateFlow fields. */
    val uiState: StateFlow<EmergencyUiState> = combine(
        repository.observeAllProtocols(),
        _selectedCategory,
        _selectedProtocol,
        _searchQuery,
        _isLoading,
        _isSyncing,
        _syncError,
    ) { values ->
        @Suppress("UNCHECKED_CAST")
        val protocols = values[0] as List<EmergencyProtocol>
        @Suppress("UNCHECKED_CAST")
        val selectedCategory = values[1] as EmergencyCategory?
        @Suppress("UNCHECKED_CAST")
        val selectedProtocol = values[2] as EmergencyProtocol?
        val searchQuery = values[3] as String
        val isLoading = values[4] as Boolean
        val isSyncing = values[5] as Boolean
        val syncError = values[6] as String?

        EmergencyUiState(
            protocols = protocols,
            selectedCategory = selectedCategory,
            selectedProtocol = selectedProtocol,
            isLoading = isLoading && protocols.isEmpty(),
            isSyncing = isSyncing,
            syncError = syncError,
            searchQuery = searchQuery,
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = EmergencyUiState(),
    )

    init {
        // Trigger initial data load when the ViewModel is created.
        viewModelScope.launch {
            repository.observeAllProtocols().collect {
                _isLoading.value = false
            }
        }
    }

    /** Processes a user interaction event. */
    fun onEvent(event: EmergencyEvent) {
        when (event) {
            is EmergencyEvent.SelectCategory -> {
                _selectedCategory.value = event.category
            }
            is EmergencyEvent.SelectProtocol -> {
                _selectedProtocol.value = event.protocol
            }
            is EmergencyEvent.Search -> {
                _searchQuery.value = event.query
            }
            is EmergencyEvent.Refresh -> {
                syncProtocols()
            }
            is EmergencyEvent.DismissError -> {
                _syncError.value = null
            }
        }
    }

    private fun syncProtocols() {
        viewModelScope.launch {
            _isSyncing.value = true
            _syncError.value = null
            try {
                repository.syncProtocols()
            } catch (e: Exception) {
                _syncError.value = "Sync failed: ${e.localizedMessage}"
            } finally {
                _isSyncing.value = false
            }
        }
    }
}
