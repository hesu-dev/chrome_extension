import Foundation

enum Roll20SafariBridgeContract {
    static let appGroupId = "group.com.reha.r20safariexport"
    static let nativeBridgeChannel = "com.reha.r20safariexport.bridge"
    static let inboxRelativePath = "roll20/inbox"
    static let pendingRelativePath = "roll20/pending"
    static let fileExtension = ".json"

    enum MessageType {
        static let storagePreflight = "R20_SAFARI_STORAGE_PREFLIGHT"
        static let writeInboxExport = "R20_SAFARI_WRITE_INBOX_EXPORT"
    }

    enum StorageBudget {
        static let maxSingleFileBytes = 8 * 1024 * 1024
        static let maxPendingBytes = 64 * 1024 * 1024
        static let maxPendingFiles = 20
        static let minFreeBytesForWrite = 256 * 1024 * 1024
    }
}
