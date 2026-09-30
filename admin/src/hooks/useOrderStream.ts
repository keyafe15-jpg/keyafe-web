import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAlerts, type PendingOrderAlert } from "@/store/alerts";
import { useAdminAuth } from "@/store/adminAuth";
import { renewSessionIfExpiring } from "@/lib/api";
import { staffHasPermission } from "@/lib/permissions";

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
  const enqueueCancelled = useAlerts((s) => s.enqueueCancelled);
  // EventSource keeps reconnecting with the URL it was opened with, so a renewed
  // token has to reopen the stream or alerts stop once the old token expires.
  const token = useAdminAuth((s) => s.accessToken);
  const canReadOrders = useAdminAuth((s) => staffHasPermission(s.user, "orders.read"));

  useEffect(() => {
    if (!canReadOrders) return;
    const url = token
      ? `/api/admin/orders/stream?access_token=${encodeURIComponent(token)}`
      : "/api/admin/orders/stream";
    const es = new EventSource(url, {
      withCredentials: true,
    });

    const refreshOrders = () => {
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "order-counts"] });
    };

    es.addEventListener("new-order", (raw) => {
      let ev: NewOrderEvent;
      try {
        ev = JSON.parse((raw as MessageEvent).data);
      } catch {
        return;
      }

      refreshOrders();
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

    es.addEventListener("order-cancelled", (raw) => {
      let ev: {
        id: string;
        orderNumber: string;
        customerName: string;
        total: string | number;
        cancelledBy: "customer" | "admin";
      };
      try {
        ev = JSON.parse((raw as MessageEvent).data);
      } catch {
        return;
      }

      refreshOrders();
      void qc.invalidateQueries({ queryKey: ["admin", "order", ev.id] });
      void qc.invalidateQueries({
        queryKey: ["admin", "order", ev.orderNumber],
      });
      enqueueCancelled({
        id: ev.id,
        orderNumber: ev.orderNumber,
        customerName: ev.customerName,
        total: ev.total,
        cancelledBy: ev.cancelledBy,
        arrivedAt: Date.now(),
      });
    });

    es.onerror = () => {
      // EventSource auto-reconnects on its own. If the failure is an expired token
      // (e.g. a kitchen tablet idle for days), renewing it changes `token` and reopens the stream.
      void renewSessionIfExpiring();
    };

    return () => {
      es.close();
    };
  }, [qc, enqueue, enqueueCancelled, token, canReadOrders]);
}
