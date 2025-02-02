import { PanelContainerProps } from "./panel.types";
import styles from "./panel-container.module.scss";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { GlobalEvents, SlotGlobalEvent } from "@comflowy/common/utils/slot-event";
import { AsyncComflowyConsole } from "../comflowy-console/comflowy-console-async";
import { Tabs, TabsProps } from "antd";
import { AsyncComfyUIProcessManager } from "../comfyui-process-manager/comfyui-process-manager-async";
import { listenElectron } from "@/lib/electron-bridge";
import { isWindow } from "ui/utils/is-window";
import { useDashboardState } from "@comflowy/common/store/dashboard-state";
import { useRouter } from "next/router";

export function PanelsContainerServerAdapter(props: PanelContainerProps) {
  const [visible, setVisible] = useState(false);
  const { bootstraped } = useDashboardState();
  const router = useRouter();
  const isApp = router.pathname === "/app";
  useEffect(() => {
    if (isWindow) {
      setVisible(true);
    }
  }, []);
  if (!visible) {
    return (
      <div className="">
        loading...
      </div>
    )
  }

  // app page use different container
  if (isApp) {
    return props.children;
  }

  if (!isApp && !bootstraped) {
    return (
      <div className="">
        {props.children}
      </div>
    )
  }

  return <PanelsContainer {...props}/>
}

/**
 * PanelContainer
 * 1) panels container 's layout struture :
 *   - main-content: the main content area
 *   - spliter: the spliter between main content and panels
 *   - panels: panels in tabs
 * 2) It's a flexbox layout structure 
 *   - main-content: flex 1 
 *   - panel-spliter: fixed width
 *   - panels: dynamic-width
 */
export function PanelsContainer(props: PanelContainerProps) {
  const draggerRef = useRef<HTMLDivElement>();
  const mainRef = useRef<HTMLDivElement>();
  const panelsRef = useRef<HTMLDivElement>();
  const localState = readPanelStateFromLocalStorage();
  const [panelsVisible, setPanelsVisible] = useState(localState.panelsVisible);
  const [panelWidth, setPanelWidth] = useState(localState.panelWidth);
  const [activePanel, setActivePanel] = useState(localState.activePanel);
  const onChangePanelWidth = (width: number) => {
    setPanelStateToLocalStorage({panelWidth: width});
    setPanelWidth(width);
  }

  useEffect(() => {
    const dragger = draggerRef.current;
    if (!dragger || !panelsVisible) {
      return;
    }
    console.log("add hook");
    const onMousedown = (e) => {
      const startX = e.clientX;
      const panels = panelsRef.current;

      const startWidth = panels.offsetWidth;
      const maxWidth = window.innerWidth - 200; // 计算最大宽度
      const onMove = (e: MouseEvent) => {
        const dx = e.clientX - startX;
        let newWidth = startWidth - dx;
        newWidth = Math.max(newWidth, 200);
        newWidth = Math.min(newWidth, maxWidth);
        onChangePanelWidth(newWidth);
      }
      
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }
    dragger.addEventListener("mousedown", onMousedown)
    return () => {
      dragger.removeEventListener("mousedown", onMousedown)
    }
  }, [draggerRef, panelsVisible])

  const onPannelVisibleChange = useCallback((visible: boolean) => {
    setPanelsVisible(visible);
    setPanelStateToLocalStorage({
      panelsVisible: visible
    })
  }, [])

  useEffect(() => {
    const key = getPanelKey("panel-visible");
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        const {panelsVisible} = readPanelStateFromLocalStorage();
        setPanelsVisible(panelsVisible);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const disposable = SlotGlobalEvent.on((ev) => {
      if (ev.type === GlobalEvents.active_panel_changed) {
        setActivePanel(ev.data.id);
        if (!panelsVisible) {
          onPannelVisibleChange(true)
        }
      }

      if (ev.type === GlobalEvents.toggle_panel_container) {
        onPannelVisibleChange(!panelsVisible);
      }
    });

    // onInit();
    const dispose = listenElectron("action", (data) => {
      if (data.type === "open-comfyui-process-manager") {
        onPannelVisibleChange(!panelsVisible);
      }
    });

    // Clean up
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      disposable.dispose();
      dispose();
    };
  }, [panelsVisible]);


  const items: TabsProps['items'] = [
    {
      key: 'terminal',
      label: 'Terminal',
      children: <AsyncComfyUIProcessManager/>,
    },
    {
      key: 'messages',
      label: 'Messages',
      children: <AsyncComflowyConsole />,
    },
  ];

  const onChange = (key: string) => {
    setActivePanel(key);
    setPanelStateToLocalStorage({ activePanel: key });
    console.log(key);
  };

  console.log("panelvisible", panelsVisible);
  
  return (
    <div className={styles.panelsWrapper}>
      <div className="main-content box" ref={mainRef}>
        {props.children}
      </div>
      {panelsVisible && (
        <>
          <div className="gap" ref={draggerRef}>
          </div>
          <div className="panels box" ref={panelsRef} style={{
            width: panelWidth
          }}>
            <Tabs defaultActiveKey="1" activeKey={activePanel} items={items} onChange={onChange} />
          </div>
        </>
      )}
    </div>
  )
}

export type PanelContainerState = {
  activePanel?: string;
  panelWidth?: number;
  panelsVisible?: boolean;
}

export function readPanelStateFromLocalStorage(): PanelContainerState {
  let ret:PanelContainerState = {
    panelsVisible: false,
    panelWidth: 200,
    activePanel: undefined,
  };
  try {
    const key = getPanelKey("state");
    const rawData = localStorage.getItem(key);
    if (rawData) {
      const data = JSON.parse(rawData);
      return {
        ...ret,
        ...data
      }
    } else {
      localStorage.setItem(key, JSON.stringify(ret));
    }
    return ret;
  } catch(err) {
    console.log(err);
  }
  return ret;
}

export function setPanelStateToLocalStorage(state: Partial<PanelContainerState>) {
  try {
    const key = getPanelKey("state");
    const rawData = localStorage.getItem(key);
    if (rawData) {
      const data = JSON.parse(rawData);
      localStorage.setItem(key, JSON.stringify({
        ...data,
        ...state
      }));
    } else {
      localStorage.setItem(key, JSON.stringify(state));
    }
  } catch(err) {
    console.log(err);
  }
}


function getPanelKey(prefix: string): string {
  let pathname = document.location.pathname + document.location.search;
  if (['/', '/templates', '/models', '/tutorials', '/extensions'].some(key => pathname === key)) {
    pathname = 'workspace'
  }

  const key = `${prefix}-${pathname}`;
  console.log(key);
  return key;
}
