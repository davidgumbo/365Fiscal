#!/bin/bash
# Service management helper for 365 Fiscal

case "$1" in
    start)
        echo "Starting 365 Fiscal services..."
        systemctl start 365fiscal-backend
        systemctl start nginx
        echo "Services started."
        ;;
    stop)
        echo "Stopping 365 Fiscal services..."
        systemctl stop 365fiscal-backend
        echo "Services stopped."
        ;;
    restart)
        echo "Restarting 365 Fiscal services..."
        systemctl restart 365fiscal-backend
        systemctl restart nginx
        echo "Services restarted."
        ;;
    status)
        echo "=== Backend Status ==="
        systemctl status 365fiscal-backend --no-pager
        echo ""
        echo "=== Nginx Status ==="
        systemctl status nginx --no-pager
        ;;
    logs)
        echo "Showing backend logs (Ctrl+C to exit)..."
        journalctl -u 365fiscal-backend -f
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
