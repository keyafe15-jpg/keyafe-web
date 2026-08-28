import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAlerts, type PendingOrderAlert } from "@/store/alerts";

interface NewOrderEvent {
  id: string;
  orderNumber: string;
  customerName: string;
  total: string | number;
  source: PendingOrderAlert["source"];
  itemCount: number;
  createdAt: string;
}

// Subscribes to the admin SSE stream and pushes new-order events onto the
// pending-alerts queue. The queue drives the NewOrderAlertModal.
export function useOrderStream() {
  const qc = useQueryClient();
  const enqueue = useAlerts((s) => s.enqueue);

  useEffect(() => {
    const es = new EventSource("/api/admin/orders/stream", {
      withCredentials: true,
    });

    es.addEventListener("new-order", (raw) => {
      let ev: NewOrderEvent;
      try {
        ev = JSON.parse((raw as MessageEvent).data);
      } catch {
        return;
      }

      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "order-counts"] });

      enqueue({
        id: ev.id,
        orderNumber: ev.orderNumber,
        customerName: ev.customerName,
        total: ev.total,
        source: ev.source,
        itemCount: ev.itemCount,
        createdAt: ev.createdAt,
        arrivedAt: Date.now(),
      });
    });

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do here.
    };

    return () => {
      es.close();
    };
  }, [qc, enqueue]);
}
