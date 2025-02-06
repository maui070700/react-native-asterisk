import React, { useEffect, useRef, useState } from "react";
import { Text, View, Button, PermissionsAndroid } from "react-native";
import { RTCView, mediaDevices, RTCPeerConnection, registerGlobals } from "react-native-webrtc";
import JsSIP from 'react-native-jssip';

const SIP_SERVER = "wss://asterisk.pawchain.net.in:8089/ws";
const SIP_USER = "user0";
const SIP_PASSWORD = "00000";
const SIP_URI = `sip:${SIP_USER}@asterisk.pawchain.net.in`;
const SIP_OTHER = `sip:1001@asterisk.pawchain.net.in`;

registerGlobals();

export default function Index() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [isWebRTC, setWebRTC] = useState(false);
  const uaRef = useRef(null);
  const sessionRef = useRef(null);

  const requestCameraPermission = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Asterisk App Camera Permission',
          message:
            'Asterisk App needs access to your camera ',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('You can use the camera');
      } else {
        console.log('Camera permission denied');
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Asterisk App Microphone Permission',
          message:
            'Asterisk App needs access to your microphone ',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('You can use the microphone');
      } else {
        console.log('Microphone permission denied');
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const requestPermission = async() => {
    await requestCameraPermission();
    await requestMicrophonePermission();
  };

  useEffect(() => {
    const socket = new JsSIP.WebSocketInterface(SIP_SERVER);
    const configuration = {
      sockets: [socket],
      uri: SIP_URI,
      password: SIP_PASSWORD,
      register: true
    };

    const ua = new JsSIP.UA(configuration);
    uaRef.current = ua;
    ua.on('connected', () => console.log('✅ WebSocket Connected!'));
    ua.on('disconnected', () => console.log('❌ WebSocket Disconnected!'));
    ua.on('registered', () => console.log('✅ SIP Registered!'));
    ua.on('unregistered', () => console.log('❌ SIP Unregistered!'));
    ua.on('registrationFailed', (data) => console.log('❌ SIP Registration Failed:', data));
    ua.on("newRTCSession", (e) => {
      console.log('✅ Server Response => ', e.session.direction);
      const session = e.session;
      sessionRef.current = session;

      if (session.direction === "incoming") {
        console.log("Incoming Call...");
        setIncomingCall(session);
      }
      session.on("accepted", () => console.log("Call Accepted"));
      session.on("confirmed", () => console.log("Call Confirmed"));
      session.on("ended", () => {
        console.log("Call Ended");
        setRemoteStream(null);
        setIncomingCall(null);
        setWebRTC(false);
      });
      
      if(session.connection != null)
      {
        session.connection.ontrack = (event) => {
          setRemoteStream(event.streams[0]);
          setWebRTC(true);
        };
      }
    });

    ua.start();
    requestPermission();
  }, []);

  const answerCall = async () => {
    if (!incomingCall) return;

    const stream = await mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    setLocalStream(stream);
    setWebRTC(true);

    incomingCall.answer({
      mediaConstraints: { audio: false, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: false, offerToReceiveVideo: false },
      sessionDescriptionHandlerOptions: {
        constraints: { audio: false, video: false },
      },
    });

    setIncomingCall(null);
  };

  const startCall = () => {
    if (!uaRef.current.isRegistered()) {
      console.log("❌ SIP is not registered. Cannot start call.");
      return;
    }
    console.log("📞 Attempting to start call...");
    const eventHandlers = {
      'progress': (e) => console.log('⏳ Call in progress...', e),
      'failed': (e) => console.log('❌ Call failed:', e),
      'ended': (e) => console.log('📴 Call ended:', e),
      'confirmed': async (e) => {
        console.log('✅ Call confirmed!', e);
        const stream = await mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        setWebRTC(true);
      }
    };

    const options = {
      eventHandlers,
      mediaConstraints: { audio: false, video: false },
      pcConfig: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
      rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: true },
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: true },
      }
    };

    try {
      const session = uaRef.current.call(SIP_OTHER, options);
      sessionRef.current = session;
      console.log("✅ Call sent!");
    } catch (error) {
      console.log("❌ Call error:", error);
    }
  };

  const endCall = async () => {
    if (sessionRef.current) {
      sessionRef.current.terminate();
    }
    
    setRemoteStream(null);
    setLocalStream(null);
    setWebRTC(false);
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Video Call App</Text>
      {(localStream && isWebRTC) && (
        <RTCView streamURL={localStream.toURL()} style={{ width: 200, height: 200 }} />
      )}
      {(remoteStream && isWebRTC) && (
        <RTCView streamURL={remoteStream.toURL()} style={{ width: 200, height: 200 }} />
      )}
      <View style={{height: 10}}></View>
      {incomingCall && <Button title="Answer Call" onPress={answerCall} />}
      <Button title="Start Call" onPress={startCall} />
      <View style={{height: 10}}></View>
      <Button title="End Call" onPress={endCall} />
    </View>
  );
}
