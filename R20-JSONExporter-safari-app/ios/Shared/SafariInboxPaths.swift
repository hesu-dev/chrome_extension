import Foundation

enum SafariInboxPathsError: LocalizedError {
    case sharedContainerUnavailable

    var errorDescription: String? {
        switch self {
        case .sharedContainerUnavailable:
            return "앱 공유 저장소를 찾을 수 없습니다."
        }
    }
}

struct SafariPendingSnapshot {
    let fileCount: Int
    let totalBytes: Int64
}

final class SafariInboxPaths {
    let fileManager: FileManager

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
    }

    func sharedContainerURL() throws -> URL {
        guard let containerURL = fileManager.containerURL(
            forSecurityApplicationGroupIdentifier: Roll20SafariBridgeContract.appGroupId
        ) else {
            throw SafariInboxPathsError.sharedContainerUnavailable
        }

        return containerURL
    }

    func inboxDirectoryURL(createIfNeeded: Bool = true) throws -> URL {
        let inboxURL = try sharedContainerURL()
            .appendingPathComponent(Roll20SafariBridgeContract.inboxRelativePath, isDirectory: true)
        if createIfNeeded {
            try fileManager.createDirectory(at: inboxURL, withIntermediateDirectories: true)
        }
        return inboxURL
    }

    func pendingSnapshot() throws -> SafariPendingSnapshot {
        let inboxURL = try inboxDirectoryURL()
        let fileURLs = try fileManager.contentsOfDirectory(
            at: inboxURL,
            includingPropertiesForKeys: [.fileSizeKey],
            options: [.skipsHiddenFiles]
        )

        let totalBytes = fileURLs.reduce(into: Int64(0)) { partialResult, fileURL in
            let values = try? fileURL.resourceValues(forKeys: [.fileSizeKey])
            partialResult += Int64(values?.fileSize ?? 0)
        }

        return SafariPendingSnapshot(fileCount: fileURLs.count, totalBytes: totalBytes)
    }
}
