import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [seatLocks, setSeatLocks] = useState({});
  const [activeShow, setActiveShow] = useState(null);
  const { user } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    if (user) {
      initializeSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [user]);

  const initializeSocket = () => {
    if (socketRef.current?.connected) {
      return;
    }

    const newSocket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
      auth: {
        token: localStorage.getItem('accessToken'),
      },
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setConnected(true);
      setSocket(newSocket);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
    });

    // Seat lock events
    newSocket.on('seatLocksUpdated', (data) => {
      console.log('Seat locks updated:', data);
      setSeatLocks(prev => ({
        ...prev,
        [data.showId]: data.lockedSeats
      }));
    });

    newSocket.on('seatBooked', (data) => {
      console.log('Seat booked:', data);
      // Update seat locks to remove booked seats
      setSeatLocks(prev => ({
        ...prev,
        [data.showId]: (prev[data.showId] || []).filter(seatId => !data.bookedSeats.includes(seatId))
      }));
    });

    newSocket.on('bookingConfirmed', (data) => {
      console.log('Booking confirmed:', data);
      // Handle booking confirmation updates
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    setSocket(newSocket);
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      setSeatLocks({});
    }
  };

  const joinShow = (showId) => {
    if (socket && connected) {
      socket.emit('joinShow', showId);
      setActiveShow(showId);
    }
  };

  const leaveShow = (showId) => {
    if (socket && connected) {
      socket.emit('leaveShow', showId);
      if (activeShow === showId) {
        setActiveShow(null);
      }
    }
  };

  const requestSeatLock = (showId, seatIds) => {
    if (socket && connected) {
      socket.emit('requestLock', {
        showId,
        seatIds,
        userId: user?.id
      });
    }
  };

  const releaseSeatLock = (showId, seatIds) => {
    if (socket && connected) {
      socket.emit('releaseLock', {
        showId,
        seatIds,
        userId: user?.id
      });
    }
  };

  const getLockedSeats = (showId) => {
    return seatLocks[showId] || [];
  };

  const isSeatLocked = (showId, seatId) => {
    const lockedSeats = getLockedSeats(showId);
    return lockedSeats.includes(seatId);
  };

  const value = {
    socket,
    connected,
    seatLocks,
    activeShow,
    joinShow,
    leaveShow,
    requestSeatLock,
    releaseSeatLock,
    getLockedSeats,
    isSeatLocked,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
