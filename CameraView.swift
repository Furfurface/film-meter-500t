import SwiftUI
import AVFoundation

/// A SwiftUI-compatible camera preview that automatically requests permission
/// and displays the live feed from the device's back camera.
struct CameraView: UIViewRepresentable {
    private let cameraService = CameraService()

    func makeUIView(context: Context) -> CameraPreviewView {
        let preview = CameraPreviewView()
        preview.videoPreviewLayer.videoGravity = .resizeAspectFill
        preview.videoPreviewLayer.session = cameraService.session
        cameraService.startSession()
        return preview
    }

    func updateUIView(_ uiView: CameraPreviewView, context: Context) {
        // Nothing to update: the capture session handles live updates automatically.
    }
}

// MARK: - UIView that hosts AVCaptureVideoPreviewLayer

private final class CameraPreviewView: UIView {
    override class var layerClass: AnyClass {
        AVCaptureVideoPreviewLayer.self
    }

    var videoPreviewLayer: AVCaptureVideoPreviewLayer {
        layer as! AVCaptureVideoPreviewLayer
    }
}

// MARK: - Camera setup & permissions

private final class CameraService: NSObject {
    let session = AVCaptureSession()

    private let sessionQueue = DispatchQueue(label: "camera.session.queue")
    private var isConfigured = false

    override init() {
        super.init()
        configureSession()
    }

    func startSession() {
        sessionQueue.async { [weak self] in
            guard let self = self, self.isConfigured, !self.session.isRunning else { return }
            self.session.startRunning()
        }
    }

    func stopSession() {
        sessionQueue.async { [weak self] in
            guard let self = self, self.session.isRunning else { return }
            self.session.stopRunning()
        }
    }

    private func configureSession() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            sessionQueue.async { self.setupSession() }
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                guard let self = self else { return }
                if granted {
                    self.sessionQueue.async { self.setupSession() }
                }
            }
        default:
            // Access has been denied or restricted. You may want to handle this upstream.
            break
        }
    }

    private func setupSession() {
        guard !isConfigured else { return }
        session.beginConfiguration()
        session.sessionPreset = .high

        defer {
            session.commitConfiguration()
            isConfigured = true
        }

        // Add camera input
        guard let videoDevice = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let videoDeviceInput = try? AVCaptureDeviceInput(device: videoDevice),
              session.canAddInput(videoDeviceInput) else {
            return
        }
        session.addInput(videoDeviceInput)

        // Add an output for better future extensibility (e.g., photo capture)
        let videoOutput = AVCaptureVideoDataOutput()
        if session.canAddOutput(videoOutput) {
            session.addOutput(videoOutput)
        }
    }
}
