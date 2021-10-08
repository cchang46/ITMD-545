'use strict';

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
  const video = document.querySelector('#self');
  $self.stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = $self.stream;
  video.style.display = 'block';
  return $self.stream
}

function stopUserMedia() {
  if ($self.stream) {
    $self.stream.getTracks().forEach((track) => {
      track.stop();
    });
    const video = document.querySelector('#self');
    video.srcObject = null;
    video.style.display = 'none';
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
}

async function handleRtcNegotiation() {
  console.log('RTC negotiation needed...');
  // send an SDP description
  $self.isMakingOffer = true;
  await $peer.connection.setLocalDescription();
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
function handleRtcTrack() {
  console.log('RTC track...');
  // attach our track to the DOM somehow
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
    const offerCollision = description.type === 'offer';
    console.log('offerCollision: ', offerCollision);
    $self.isIgnoringOffer = !$self.isPolite && offerCollision;
    console.log('isIgnoringOffer: ', $self.isIgnoringOffer);

    if ($self.isIgnoringOffer) {
      return;
    }

    await $peer.connection.setRemoteDescription(description);

    if (description.type === 'offer') {
      await $peer.connection.setLocalDescription();
      sc.emit('signal',
        { description:
          $peer.connection.localDescription });
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
