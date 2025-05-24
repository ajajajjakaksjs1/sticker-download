#!/bin/bash

# Telegram Sticker Bot Control Script

BOT_NAME="sticker-bot"
PID_FILE="bot.pid"
LOG_FILE="bot.log"

case "$1" in
    start)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat $PID_FILE)
            if ps -p $PID > /dev/null 2>&1; then
                echo "Bot is already running (PID: $PID)"
                exit 1
            else
                rm -f $PID_FILE
            fi
        fi
        
        echo "Starting $BOT_NAME..."
        npm run build
        nohup npm start > $LOG_FILE 2>&1 &
        echo $! > $PID_FILE
        echo "Bot started with PID: $(cat $PID_FILE)"
        echo "Logs: tail -f $LOG_FILE"
        ;;
        
    stop)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat $PID_FILE)
            if ps -p $PID > /dev/null 2>&1; then
                echo "Stopping $BOT_NAME (PID: $PID)..."
                kill $PID
                rm -f $PID_FILE
                echo "Bot stopped"
            else
                echo "Bot is not running"
                rm -f $PID_FILE
            fi
        else
            echo "Bot is not running (no PID file)"
        fi
        ;;
        
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
        
    status)
        if [ -f "$PID_FILE" ]; then
            PID=$(cat $PID_FILE)
            if ps -p $PID > /dev/null 2>&1; then
                echo "Bot is running (PID: $PID)"
                echo "Memory usage: $(ps -p $PID -o rss= | awk '{print $1/1024 " MB"}')"
                echo "CPU usage: $(ps -p $PID -o %cpu= | awk '{print $1"%"}')"
            else
                echo "Bot is not running (stale PID file)"
                rm -f $PID_FILE
            fi
        else
            echo "Bot is not running"
        fi
        ;;
        
    logs)
        if [ -f "$LOG_FILE" ]; then
            tail -f $LOG_FILE
        else
            echo "No log file found"
        fi
        ;;
        
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the bot"
        echo "  stop    - Stop the bot"
        echo "  restart - Restart the bot"
        echo "  status  - Show bot status"
        echo "  logs    - Show bot logs (tail -f)"
        exit 1
        ;;
esac

exit 0