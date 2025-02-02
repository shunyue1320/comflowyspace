import config from '@comflowy/common/config';
import { useWebSocket } from 'react-use-websocket/dist/lib/use-websocket'
import { Message } from '@comflowy/common/comfui-interfaces';
import { useAppStore } from '@comflowy/common/store';
import { useEffect, useState } from 'react';
import {useQueueState} from '@comflowy/common/store/comfyui-queue-state';
import { GlobalEvents, SlotGlobalEvent } from '@comflowy/common/utils/slot-event';
import { ComfyUIEvents } from '@comflowy/common/comfui-interfaces/comfy-event-types';
import { track } from '@/lib/tracker';
export function WsController(): JSX.Element {
  const clientId = useAppStore((st) => st.clientId);
  const nodeInProgress = useAppStore((st) => st.nodeInProgress);
  const onNewClientId = useAppStore((st) => st.onNewClientId);
  const onQueueUpdate = useQueueState((st) => st.onQueueUpdate);
  const onNodeInProgress = useAppStore((st) => st.onNodeInProgress);
  const onImageSave = useAppStore((st) => st.onImageSave);
  const editorEvent = useAppStore(st => st.editorEvent);
  const nodeIdInProgress = nodeInProgress?.id;
  const [socketUrl, setSocketUrl] = useState(`ws://${config.host}/comfyui/ws`);
  const [timestamp, setTimestamp] = useState(Date.now());

  const { sendJsonMessage, lastMessage } = useWebSocket(socketUrl, {
    queryParams: clientId ? { clientId, timestamp } : {},
    onMessage: (ev) => {
      const msg = JSON.parse(ev.data)
      editorEvent.emit({
        type: ComfyUIEvents.RunMessage,
        data: msg
      });
      // console.log("msg", msg)
      if (Message.isStatus(msg)) {
        if (msg.data.sid !== undefined && msg.data.sid !== clientId) {
          onNewClientId(msg.data.sid)
        }
        void onQueueUpdate()
      } else if (Message.isExecuting(msg)) {
        if (msg.data.node !== undefined) {
          onNodeInProgress(msg.data.node, 0)
        } else if (nodeIdInProgress !== undefined) {
          onNodeInProgress(nodeIdInProgress, 0)
        }
      } else if (Message.isProgress(msg)) {
        if (nodeIdInProgress !== undefined) {
          onNodeInProgress(nodeIdInProgress, msg.data.value / msg.data.max)
        }
      } else if (Message.isExecuted(msg)) {
        track('comfyui-executed-success');
        const images = msg.data.output.images
        if (Array.isArray(images)) {
          onImageSave(msg.data.node, images)
        }
      } else if (Message.isExecutingInterrupted) {
        track('comfyui-executed-interrupted');
        SlotGlobalEvent.emit({
          type: GlobalEvents.execution_interrupted,
          data: null
        });
      }
    },
  });

  useEffect(() => {
    const disposable = SlotGlobalEvent.on((event) => {
      if (event.type === GlobalEvents.comfyui_process_error) {
        // message.error("Runtime Error: " + event.data.message);
      }
    })

    const disposable2 = SlotGlobalEvent.on((event) => {
      if (event.type === GlobalEvents.restart_comfyui_success) {
        // console.log("try to reconncet websocket")
        setTimestamp(Date.now())
      }
    })

    return () => {
      disposable.dispose();
      disposable2.dispose();
    }
  }, []);

  // const [pongReceived, setPongReceived] = useState(true);
  // // Send a ping every 5 seconds
  // useEffect(() => {
  //   const pingInterval = setInterval(() => {
  //     sendJsonMessage('ping');
  //     setPongReceived(false);
  //   }, 5000);
  //   return () => clearInterval(pingInterval);
  // }, [sendJsonMessage]);

  // // Reset pong status when a pong is received
  // useEffect(() => {
  //   if (lastMessage && lastMessage.data === 'pong') {
  //     console.log("receive pond");
  //     setPongReceived(true);
  //   }
  // }, [lastMessage]);

  // // Check if a pong is received, if no pong is received within 5 seconds, it is considered that the connection is disconnected and needs to be reconnected
  // useEffect(() => {
  //   if (!pongReceived) {
  //     setTimeout(() => {
  //       if (!pongReceived) {
  //         console.log("No pong received, reconnecting...");
  //         setSocketUrl(`ws://${config.host}/comfyui/ws?timestamp=${Date.now()}`);
  //       }
  //     }, 5000); // If there is no response within 5 seconds, reconnect
  //   }
  // }, [pongReceived]);

  return <></>
}
