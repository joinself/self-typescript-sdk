import SelfSDK from '../src/self-sdk';
import MessagingService from "../src/messaging-service"

/**
 * Messaging service test
 */

let sdk: SelfSDK;

describe("Messaging service", () => {
    beforeEach(async () => {
        sdk = await SelfSDK.build( "109a21fdd1bfaffa2717be1b4edb57e9", "RmfQdahde0n5SSk1iF4qA2xFbm116RNjjZe47Swn1s4", "random");
    })

    afterEach(async () => {
        sdk.jwt.stop()
    })

    it("subscribe is truthy", () => {
        let req = sdk.messaging().subscribe("my.message.type", () => {
            console.log("called back")
        })
        expect(req).toBeTruthy()
    })

    it("permitting connections is truthy", () => {
        let req = sdk.messaging().permitConnection("myselfid")
        expect(req).toBeTruthy()
    })

    it("revoking connections is truthy", () => {
        let req = sdk.messaging().revokeConnection("myselfid")
        expect(req).toBeTruthy()
    })

    it("listing connections is empty", () => {
        let conns = sdk.messaging().allowedConnections()
        expect(conns.length).toBe(0)
    })

    it("deviceID is a string", () => {
        let req = sdk.messaging().deviceID()
        expect(req).toBe("1")
    })

    it("send is truthy", () => {
        let req = sdk.messaging().send("myselfid", {"some": "thing"})
        expect(req).toBeTruthy()
    })

    it("notify is truthy", () => {
        let req = sdk.messaging().notify("myselfid", "some message")
        expect(req).toBeTruthy()
    })
})
