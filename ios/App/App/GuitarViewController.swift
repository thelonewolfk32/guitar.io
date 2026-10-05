import Capacitor

class GuitarViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(GuitarLocalPlugin())
    }
}
