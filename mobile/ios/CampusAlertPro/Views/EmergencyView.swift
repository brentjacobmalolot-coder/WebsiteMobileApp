//
//  EmergencyView.swift
//  CampusAlertPro
//
//  Main SwiftUI screen displaying cached emergency protocols.
//

import SwiftUI

struct EmergencyView: View {
    @StateObject private var repository = EmergencyRepository.shared
    @State private var selectedCategory: EmergencyCategory? = nil
    @State private var searchQuery: String = ""
    @State private var isRefreshing: Bool = false
    @State private var syncError: String? = nil

    var filteredProtocols: [EmergencyProtocol] {
        repository.protocols
            .filter { p in selectedCategory == nil || p.category == selectedCategory }
            .filter { p in searchQuery.isEmpty || p.title.localizedCaseInsensitiveContains(searchQuery) }
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                Color(red: 0.957, green: 0.969, blue: 0.961)
                    .ignoresSafeArea()

                VStack(spacing: 0) {
                    headerBar

                    if let error = syncError {
                        offlineBanner(message: error)
                    }

                    categoryFilter
                        .padding(.vertical, 8)

                    if repository.protocols.isEmpty {
                        emptyState
                    } else if filteredProtocols.isEmpty {
                        noResultsState
                    } else {
                        protocolList
                    }
                }
            }
            .navigationBarHidden(true)
        }
    }

    // MARK: - Header

    private var headerBar: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(LinearGradient(
                        colors: [Color(red: 0.106, green: 0.302, blue: 0.243),
                                 Color(red: 0.529, green: 0.663, blue: 0.420)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                    .frame(width: 44, height: 44)
                Image(systemName: "exclamationmark.shield.fill")
                    .foregroundColor(.white)
                    .font(.title3)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text("CampusAlert Pro")
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundColor(Color(red: 0.106, green: 0.302, blue: 0.243))
                Text("Emergency Protocols")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button {
                Task { await refresh() }
            } label: {
                if isRefreshing {
                    ProgressView()
                        .tint(Color(red: 0.106, green: 0.302, blue: 0.243))
                } else {
                    Image(systemName: "arrow.clockwise")
                        .foregroundColor(Color(red: 0.106, green: 0.302, blue: 0.243))
                        .font(.title3)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
        .padding(.bottom, 12)
        .background(Color.white)
    }

    // MARK: - Offline Banner

    private func offlineBanner(message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "cloud.slash.fill")
                .foregroundColor(Color(red: 0.961, green: 0.620, blue: 0.043))
            Text("Offline mode — showing cached protocols")
                .font(.caption)
                .foregroundColor(Color(red: 0.961, green: 0.620, blue: 0.043))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color(red: 0.961, green: 0.620, blue: 0.043).opacity(0.12))
    }

    // MARK: - Category Filter

    private var categoryFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                CategoryChip(
                    title: "All",
                    icon: "shield.fill",
                    isSelected: selectedCategory == nil
                ) { selectedCategory = nil }

                ForEach(EmergencyCategory.allCases.filter { $0 != .unknown }, id: \.self) { category in
                    CategoryChip(
                        title: category.displayName,
                        icon: category.iconSystemName,
                        isSelected: selectedCategory == category
                    ) { selectedCategory = category }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - List

    private var protocolList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(filteredProtocols) { protocol in
                    ProtocolCardView(protocol: protocol)
                        .onTapGesture { /* Navigate to detail */ }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .refreshable { await refresh() }
    }

    // MARK: - Empty States

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "shield.fill")
                .font(.system(size: 64))
                .foregroundColor(.secondary.opacity(0.5))
            Text("No protocols available")
                .font(.headline)
                .foregroundColor(.secondary)
            Text("Pull to refresh when online")
                .font(.subheadline)
                .foregroundColor(.secondary.opacity(0.7))
            Spacer()
        }
    }

    private var noResultsState: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "magnifyingglass")
                .font(.system(size: 48))
                .foregroundColor(.secondary.opacity(0.5))
            Text("No matching protocols")
                .font(.subheadline)
                .foregroundColor(.secondary)
            Spacer()
        }
    }

    // MARK: - Actions

    private func refresh() async {
        isRefreshing = true
        syncError = nil
        do {
            try await repository.syncProtocols()
        } catch {
            syncError = "Sync failed: \(error.localizedDescription)"
        }
        isRefreshing = false
    }
}

// MARK: - Components

private struct CategoryChip: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                Text(title)
                    .font(.caption)
                    .fontWeight(.semibold)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                isSelected
                    ? Color(red: 0.106, green: 0.302, blue: 0.243)
                    : Color.white
            )
            .foregroundColor(
                isSelected ? .white : Color(red: 0.106, green: 0.302, blue: 0.243)
            )
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(
                        isSelected
                            ? Color.clear
                            : Color(red: 0.106, green: 0.302, blue: 0.243).opacity(0.2),
                        lineWidth: 1
                    )
            )
        }
    }
}

private struct ProtocolCardView: View {
    let protocol: EmergencyProtocol

    var categoryColor: Color {
        switch protocol.category {
        case .weather: return Color(red: 0.961, green: 0.620, blue: 0.043)
        case .lockdown: return Color(red: 0.863, green: 0.149, blue: 0.149)
        case .evacuation: return Color(red: 0.106, green: 0.302, blue: 0.243)
        case .medical: return Color(red: 0.863, green: 0.149, blue: 0.149)
        case .fire: return Color(red: 0.976, green: 0.451, blue: 0.086)
        case .hazmat: return Color(red: 0.486, green: 0.227, blue: 0.929)
        case .earthquake: return Color(red: 0.961, green: 0.620, blue: 0.043)
        case .infrastructure: return Color(red: 0.392, green: 0.455, blue: 0.545)
        case .unknown: return Color(red: 0.529, green: 0.663, blue: 0.420)
        }
    }

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(categoryColor.opacity(0.15))
                    .frame(width: 48, height: 48)
                Image(systemName: protocol.category.iconSystemName)
                    .foregroundColor(categoryColor)
                    .font(.title3)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(protocol.title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                    .lineLimit(2)

                if !protocol.summary.isEmpty {
                    Text(protocol.summary)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }

                HStack(spacing: 6) {
                    Text(protocol.category.displayName)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(categoryColor.opacity(0.15))
                        .foregroundColor(categoryColor)
                        .clipShape(RoundedRectangle(cornerRadius: 6))

                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(Color(red: 0.529, green: 0.663, blue: 0.420))
                        .font(.caption2)
                    Text("Cached")
                        .font(.caption2)
                        .foregroundColor(Color(red: 0.529, green: 0.663, blue: 0.420))
                }
            }

            Spacer()
        }
        .padding(16)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.black.opacity(0.04), radius: 4, x: 0, y: 2)
    }
}

#Preview {
    EmergencyView()
}
