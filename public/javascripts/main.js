'use strict';

const $self = {
    rtcConfig: null,
    constraints: { audio: false, video:true }

};

const $peer = {

    connection: new RTCPeerConnection($self.rtcConfig)

};

requestUserMedia($self.constraints);

async function requestUserMedia(constraints) {
   const video = document.querySelector('#self');
   $self.stream = await navigator.mediaDevices.getUserMedia(constraints);
   video.srcObject =  $self.stream;
}

/**
* Socket Server Events and Callbacks
*/

const namespace = prepareNamespace(window.location.hash, true);

const sc = io(`/${namespace}`, { autoConnect: false});

registerScEvents();


const button = document.querySelector('#call-button');
button.addEventListener('click', handleButton);
/* DOM Events */
function handleButton(e) {
  const button = e.target;
  if (button.className === 'join') {
    button.className = 'leave';
    button.innerText = 'Leave Chat';
    // joinChat();
  } else {
    button.className = 'join';
    button.innerText = 'Join Chat';
    // leaveChat();
  }
}

function joinChat() {
   sc.open();
}

function leaveChat() {
   sc.close();
}

/* Signaling Channel Events */

function registerScEvents() {
  sc.on('connect', handleScConnect);
  sc.on('connected peer', handleScConnectedPeer);
  sc.on('signal', handleScSignal);
  sc.on('disconnected peer', handleScDisconnectedPeer)
}


function handleScConnect() {
  console.log('Connected to signaling channel!');
}
function handleScConnectedPeer() {
  console.log('Heard connected peer event!');
}
function handleScDisconnectedPeer() {
  console.log('Heard disconnected peer event!');
}
async function handleScSignal() {
  console.log('Heard signal event!');
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
