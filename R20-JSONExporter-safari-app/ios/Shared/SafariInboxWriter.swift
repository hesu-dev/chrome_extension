import Foundation

struct SafariInboxWriteResult {
    let savedFileName: String
    let pendingCount: Int
    let pendingBytes: Int64
    let inboxRelativePath: String
}

final class SafariInboxWriter {
    private let fileManager: FileManager
    private let paths: SafariInboxPaths
    private let storageBudget: SafariStorageBudget

    init(
        fileManager: FileManager = .default,
        paths: SafariInboxPaths = SafariInboxPaths(),
        storageBudget: SafariStorageBudget = SafariStorageBudget()
    ) {
        self.fileManager = fileManager
        self.paths = paths
        self.storageBudget = storageBudget
    }

    func write(filenameBase: String, jsonText: String) throws -> SafariInboxWriteResult {
        let payloadData = Data(jsonText.utf8)
        let containerURL = try paths.sharedContainerURL()
        let snapshotBeforeWrite = try paths.pendingSnapshot()
        _ = try storageBudget.preflight(
            payloadBytes: payloadData.count,
            pendingBytes: snapshotBeforeWrite.totalBytes,
            pendingFiles: snapshotBeforeWrite.fileCount,
            containerURL: containerURL
        )

        let inboxURL = try paths.inboxDirectoryURL()
        let finalURL = try nextAvailableURL(
            in: inboxURL,
            baseName: sanitizeFileNameBase(filenameBase),
            fileExtension: Roll20SafariBridgeContract.fileExtension
        )
        let tempURL = inboxURL.appendingPathComponent("\(UUID().uuidString).tmp")
        try payloadData.write(to: tempURL, options: .atomic)
        try fileManager.moveItem(at: tempURL, to: finalURL)

        let snapshotAfterWrite = try paths.pendingSnapshot()
        return SafariInboxWriteResult(
            savedFileName: finalURL.lastPathComponent,
            pendingCount: snapshotAfterWrite.fileCount,
            pendingBytes: snapshotAfterWrite.totalBytes,
            inboxRelativePath: Roll20SafariBridgeContract.inboxRelativePath
        )
    }

    private func sanitizeFileNameBase(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallback = trimmed.isEmpty ? "roll20-chat" : trimmed
        return fallback
            .replacingOccurrences(of: "/", with: "-")
            .replacingOccurrences(of: ":", with: "-")
    }

    private func nextAvailableURL(in directoryURL: URL, baseName: String, fileExtension: String) throws -> URL {
        let normalizedExtension = fileExtension.hasPrefix(".") ? String(fileExtension.dropFirst()) : fileExtension
        var suffix = 0
        while true {
            let candidateName = suffix == 0 ? baseName : "\(baseName)-\(suffix + 1)"
            let finalURL = directoryURL.appendingPathComponent(candidateName).appendingPathExtension(normalizedExtension)
            if !fileManager.fileExists(atPath: finalURL.path) {
                return finalURL
            }
            suffix += 1
        }
    }
}
