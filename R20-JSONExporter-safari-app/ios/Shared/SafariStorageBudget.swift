import Foundation

enum SafariStorageBudgetError: LocalizedError {
    case emptyPayload
    case payloadTooLarge
    case pendingBytesExceeded
    case pendingFilesExceeded
    case lowDiskSpace

    var errorDescription: String? {
        switch self {
        case .emptyPayload:
            return "The Safari inbox payload is empty."
        case .payloadTooLarge:
            return "The Safari inbox payload exceeds the single file budget."
        case .pendingBytesExceeded:
            return "The Safari inbox is above the pending byte budget."
        case .pendingFilesExceeded:
            return "The Safari inbox already has too many pending files."
        case .lowDiskSpace:
            return "The device does not have enough free space for a safe inbox write."
        }
    }
}

struct SafariStorageBudgetSnapshot {
    let payloadBytes: Int
    let pendingBytes: Int64
    let pendingFiles: Int
    let freeBytes: Int64
}

final class SafariStorageBudget {
    func preflight(
        payloadBytes: Int,
        pendingBytes: Int64,
        pendingFiles: Int,
        containerURL: URL
    ) throws -> SafariStorageBudgetSnapshot {
        guard payloadBytes > 0 else {
            throw SafariStorageBudgetError.emptyPayload
        }
        guard payloadBytes <= Roll20SafariBridgeContract.StorageBudget.maxSingleFileBytes else {
            throw SafariStorageBudgetError.payloadTooLarge
        }
        guard pendingFiles + 1 <= Roll20SafariBridgeContract.StorageBudget.maxPendingFiles else {
            throw SafariStorageBudgetError.pendingFilesExceeded
        }
        guard pendingBytes + Int64(payloadBytes) <= Roll20SafariBridgeContract.StorageBudget.maxPendingBytes else {
            throw SafariStorageBudgetError.pendingBytesExceeded
        }

        let values = try containerURL.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        let freeBytes = values.volumeAvailableCapacityForImportantUsage ?? 0
        let requiredBytes = max(
            Int64(Roll20SafariBridgeContract.StorageBudget.minFreeBytesForWrite),
            Int64(payloadBytes * 2 + 4 * 1024 * 1024)
        )
        guard freeBytes >= requiredBytes else {
            throw SafariStorageBudgetError.lowDiskSpace
        }

        return SafariStorageBudgetSnapshot(
            payloadBytes: payloadBytes,
            pendingBytes: pendingBytes,
            pendingFiles: pendingFiles,
            freeBytes: freeBytes
        )
    }
}
