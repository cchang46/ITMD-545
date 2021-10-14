'use strict';

const INIT_MESSAGE = '====INIT_MESSAGE====';

const $self = {
  rtcConfig: null,
  constraints: { audio: false, video: true },
  isPolite: false,
  isMakingOffer: false,
  isIgnoringOffer: false,
  isSettingRemoteAnswerPending: false
};

const $peer = {
  connection: new RTCPeerConnection($self.rtcConfig)
};

async function requestUserMedia(constraints) {
  const video = document.querySelector('#self-video');
  $self.stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = $self.stream;
  document.querySelector('#live-chat').style.display = 'flex';
  return $self.stream;
}

function stopUserMedia() {
  if ($self.stream) {
    $self.stream.getTracks().forEach((track) => {
      track.stop();
    });
    const selfVideo = document.querySelector('#self-video');
    selfVideo.srcObject = null;
    const peerVideo = document.querySelector('#peer-video');
    peerVideo.srcObject = null;
    peerVideo.style.display = 'none';
    document.querySelector('#live-chat').style.display = 'none';
  }
}

/**
* Socket Server Events and Callbacks
*/

const namespace = prepareNamespace(window.location.hash, true);

const sc = io(`/${namespace}`, { autoConnect: false});

registerChannelEvents();

const button = document.querySelector('#call-yuuki');
button.addEventListener('click', handleButton);
/* DOM Events */
function handleButton(e) {
  const button = e.target;
  if (button.className === 'join') {
    button.className = 'leave';
    button.innerText = 'Leave Chat';
    requestUserMedia($self.constraints).then(() => joinChat());
  } else {
    button.className = 'join';
    button.innerText = 'Join Chat';
    stopUserMedia();
    leaveChat();
  }
}

/* Chat Room */
const chatRoom = document.querySelector('#chat-room');
chatRoom.addEventListener('submit', handleChatRoom);

const messenger =  document.querySelector('#messenger');
messenger.addEventListener('click', showChatRoom);

function handleMessenger() {
  if(!$self.chatChannelPromise) {
    $self.chatChannelPromise = new Promise((resolve, reject) => {
      $self.resolveChatChannel = resolve;
      $peer.chatChannel = $peer.connection.createDataChannel('chat');
      $peer.chatChannel.onmessage = handleMessage;
    });
  }

  return $self.chatChannelPromise;
}

function showChatRoom () {
  document.querySelector('#chat-room').style.display = 'block';
}

function handleMessage ({data}) {
  if ($self.resolveChatChannel && data === INIT_MESSAGE) {
    console.log('chat channel initiated');
    $self.resolveChatChannel();
    $self.resolveChatChannel = null;
  } else {
    console.log('received message ', data);
    appendMessage(data, 'receiver');
  }
}

function handleChatRoom(e) {
  e.preventDefault();
  const form = e.target;
  const input = form.querySelector('#message');
  const message = input.value;
  input.value = '';

  // Make sure chat channel is open before sending message
  handleMessenger().then(() => {
    $peer.chatChannel.send(message);
    console.log('Sender msg:', message);
    appendMessage(message, 'sender');
  })
}

function appendMessage(message, msgClass) {
  const messages = document.querySelector('#messages');
  const li = document.createElement('li');
  li.className = msgClass;
  li.innerText = message;
  messages.appendChild(li);
}

function joinChat() {
   sc.open();
   registerRtcEvents($peer);
   establishCallFeatures($peer);
}

function leaveChat() {
   sc.close();
}

/* WebRTC Events */
function establishCallFeatures(peer) {
  peer.connection.addTrack($self.stream.getTracks()[0],
      $self.stream);
}

function registerRtcEvents(peer) {
  peer.connection
    .onnegotiationneeded = handleRtcNegotiation;
  peer.connection
    .onicecandidate = handleIceCandidate;
  peer.connection
    .ontrack = handleRtcTrack;
  peer.connection
    .ondatachannel = handleRtcDataChannel;
}

async function handleRtcNegotiation() {
  console.log('RTC negotiation needed...');
  // send an SDP description
  $self.isMakingOffer = true;
  try {
    await $peer.connection.setLocalDescription();
  } catch (e) {
    const offer = await $peer.connection.createOffer();
    await $peer.connection.setLocalDescription(offer);
  }finally {
    // finally, however this was done, send the localDescription to the remote peer
    sc.emit('signal', { description:
      $peer.connection.localDescription });
  }

  $self.isMakingOffer = false;
  console.log('Send description...');
  sc.emit('signal', { description:
    $peer.connection.localDescription });
  $self.isMakingOffer = false;
}
function handleIceCandidate({ candidate }) {
  // send ICE candidate
  console.log('Send ICE candidate...');
  sc.emit('signal', { candidate:
    candidate });
}
function handleRtcTrack({ streams: [stream] }) {
  console.log('RTC track...');
  // attach incoming track to the DOM
  displayPeer(stream);
}

function handleRtcDataChannel(dataChannelEvent){
   console.log('Heard data channel', dataChannelEvent.channel.label);
   dataChannelEvent.channel.onmessage = handleMessage;
   $peer.chatChannel = dataChannelEvent.channel;
   showChatRoom();
   $peer.chatChannel.send(INIT_MESSAGE);
}


/* Video DOM */
function displayPeer(stream) {
  const video = document.querySelector("#peer-video");
  video.style.display = 'block';
  video.srcObject = stream;
}

/* Signaling Channel Events */

function registerChannelEvents() {
  sc.on('connect', handleChannelConnect);
  sc.on('connected peer', handleChannelConnectedPeer);
  sc.on('signal', handleChannelSignal);
  sc.on('disconnected peer', handleChannelDisconnectedPeer);
}

function handleChannelConnect() {
  console.log('Connected to signaling channel!');
}
function handleChannelConnectedPeer() {
  console.log('Heard connected peer event!');
  $self.isPolite = true;
}
function handleChannelDisconnectedPeer() {
  console.log('Heard disconnected peer event!');
}
async function handleChannelSignal({ description, candidate }) {
  console.log('Heard signal event!');
  if (description) {
    console.log('Received SDP Signal:', description);
    console.log('isMakingOffer: ', $self.isMakingOffer);
    console.log('signalingState: ', $peer.connection.signalingState);
    console.log('isSettingRemoteAnswerPending: ', $self.isSettingRemoteAnswerPending);
    const readyForOffer =
        !$self.isMakingOffer &&
        ($peer.connection.signalingState === 'stable'
          || $self.isSettingRemoteAnswerPending);

    console.log('readyForOffer: ', readyForOffer);
    const offerCollision = description.type === 'offer' && !readyForOffer;

    console.log('offerCollision: ', offerCollision);
    //inPolite && have offerCollision
    //offerCollision will be true if type is offer && not readyForOffer
    //but I'm inPolite I'm aways providing offer for the first connection
    //so offerCollision only occurs if it's not the first connection and the remote end initiate the offerCollision
    //and I'm not currently making an offer, and the connection is not stable or I'm about to accepting the answer from the remote end.
    $self.isIgnoringOffer = !$self.isPolite && offerCollision;
    console.log('isIgnoringOffer: ', $self.isIgnoringOffer);

    if ($self.isIgnoringOffer) {
      return;
    }

    console.log('description type: ', description.type);
    $self.isSettingRemoteAnswerPending = description.type === 'answer';
    await $peer.connection.setRemoteDescription(description);
    $self.isSettingRemoteAnswerPending = false;

    if (description.type === 'offer') {
      try {
        await $peer.connection.setLocalDescription();
      } catch(e) {
        const answer = await $peer.connection.createAnswer();
        await $peer.connection.setLocalDescription(answer);
      } finally {
        sc.emit('signal',
          { description:
            $peer.connection.localDescription });
      }
    }

  } else if (candidate) {
    console.log('Received ICE candidate:', candidate);
    try {
      await $peer.connection.addIceCandidate(candidate);
    } catch(e) {
      if (!$self.isIgnoringOffer) {
        console.error('Cannot add ICE candidate for peer', e);
      }
    }
  }
}

/**
 *  Utility Functions
 */
function prepareNamespace(hash, set_location) {
  let ns = hash.replace(/^#/, ''); // remove # from the hash
  if (/^[0-9]{5}$/.test(ns)) {
    console.log('Checked existing namespace', ns);
    return ns;
  }
  ns = Math.random().toString().substring(2, 7);
  console.log('Created new namespace', ns);
  if (set_location) window.location.hash = ns;
  return ns;
}
