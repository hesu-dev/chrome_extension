import Foundation

enum SafariStorageBudgetError: LocalizedError {
    case emptyPayload
    case lowDiskSpace

    var errorDescription: String? {
        switch self {
        case .emptyPayload:
            return "The Safari inbox payload is empty."
        case .lowDiskSpace:
            return "The device does not have enough free space for a safe inbox write."
        }
    }
}

struct SafariStorageBudgetSnapshot {
    let payloadBytes: Int
    let freeBytes: Int64
}

final class SafariStorageBudget {
    func preflight(
        payloadBytes: Int,
        containerURL: URL
    ) throws -> SafariStorageBudgetSnapshot {
        guard payloadBytes > 0 else {
            throw SafariStorageBudgetError.emptyPayload
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
            freeBytes: freeBytes
        )
    }
}
