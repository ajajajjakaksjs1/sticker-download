#!/bin/bash

BOT_NAME="sticker-bot"
BOT_DIR="/workspace/sticker-download"
PID_FILE="$BOT_DIR/bot.pid"
LOG_FILE="$BOT_DIR/bot.log"

start() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo "Bot is already running (PID: $PID)"
            return 1
        else
            rm -f "$PID_FILE"
        fi
    fi
    
    echo "Starting $BOT_NAME..."
    cd "$BOT_DIR"
    nohup python main.py > "$LOG_FILE" 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"
    echo "Bot started with PID: $PID"
    sleep 2
    
    if ps -p $PID > /dev/null 2>&1; then
        echo "Bot is running successfully"
    else
        echo "Failed to start bot"
        rm -f "$PID_FILE"
        return 1
    fi
}

stop() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo "Stopping $BOT_NAME (PID: $PID)..."
            kill $PID
            sleep 2
            
            if ps -p $PID > /dev/null 2>&1; then
                echo "Force killing bot..."
                kill -9 $PID
            fi
            
            rm -f "$PID_FILE"
            echo "Bot stopped"
        else
            echo "Bot is not running"
            rm -f "$PID_FILE"
        fi
    else
        echo "Bot is not running (no PID file)"
    fi
}

status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo "Bot is running (PID: $PID)"
            return 0
        else
            echo "Bot is not running (stale PID file)"
            rm -f "$PID_FILE"
            return 1
        fi
    else
        echo "Bot is not running"
        return 1
    fi
}

logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -f "$LOG_FILE"
    else
        echo "Log file not found: $LOG_FILE"
    fi
}

restart() {
    stop
    sleep 1
    start
}

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac

exit $?