import SafariServices

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    private let inboxPaths = SafariInboxPaths()
    private let storageBudget = SafariStorageBudget()
    private let inboxWriter = SafariInboxWriter()

    func beginRequest(with context: NSExtensionContext) {
        let responseItem = NSExtensionItem()
        responseItem.userInfo = [
            SFExtensionMessageKey: handleMessage(extractMessage(from: context))
        ]
        context.completeRequest(returningItems: [responseItem], completionHandler: nil)
    }

    private func extractMessage(from context: NSExtensionContext) -> [String: Any] {
        let inputItem = context.inputItems.first as? NSExtensionItem
        return inputItem?.userInfo?[SFExtensionMessageKey] as? [String: Any] ?? [:]
    }

    private func handleMessage(_ message: [String: Any]) -> [String: Any] {
        switch String(describing: message["type"] ?? "") {
        case Roll20SafariBridgeContract.MessageType.storagePreflight:
            return handleStoragePreflight(message)
        case Roll20SafariBridgeContract.MessageType.writeInboxExport:
            return handleWriteInboxExport(message)
        default:
            return [
                "ok": false,
                "errorMessage": "지원하지 않는 Safari 브리지 요청입니다."
            ]
        }
    }

    private func handleStoragePreflight(_ message: [String: Any]) -> [String: Any] {
        do {
            let payloadBytes = intValue(message["payloadBytes"])
            let containerURL = try inboxPaths.sharedContainerURL()
            let snapshot = try inboxPaths.pendingSnapshot()
            let budgetSnapshot = try storageBudget.preflight(
                payloadBytes: payloadBytes,
                containerURL: containerURL
            )
            return [
                "ok": true,
                "pendingCount": snapshot.fileCount,
                "pendingBytes": snapshot.totalBytes,
                "freeBytes": budgetSnapshot.freeBytes
            ]
        } catch {
            return [
                "ok": false,
                "errorMessage": error.localizedDescription
            ]
        }
    }

    private func handleWriteInboxExport(_ message: [String: Any]) -> [String: Any] {
        do {
            let result = try inboxWriter.write(
                filenameBase: String(describing: message["filenameBase"] ?? ""),
                jsonText: String(describing: message["jsonText"] ?? "")
            )
            return [
                "ok": true,
                "savedFileName": result.savedFileName,
                "pendingCount": result.pendingCount,
                "pendingBytes": result.pendingBytes,
                "inboxRelativePath": result.inboxRelativePath
            ]
        } catch {
            return [
                "ok": false,
                "errorMessage": error.localizedDescription
            ]
        }
    }

    private func intValue(_ raw: Any?) -> Int {
        if let value = raw as? Int {
            return value
        }
        if let value = raw as? NSNumber {
            return value.intValue
        }
        if let value = raw as? String, let parsed = Int(value) {
            return parsed
        }
        return 0
    }
}
