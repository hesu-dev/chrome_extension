import Foundation

enum SafariStorageBudgetError: LocalizedError {
    case emptyPayload
    case lowDiskSpace

    var errorDescription: String? {
        switch self {
        case .emptyPayload:
            return "복사할 파일 내용이 비어 있습니다."
        case .lowDiskSpace:
            return "기기에 안전하게 복사할 만큼의 여유 공간이 부족합니다."
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
