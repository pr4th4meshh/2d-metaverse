import { useEffect, useRef, useState } from 'react';

// Define types for user and WebSocket message
interface User {
  x: number;
  y: number;
  userId: string;
}

interface WebSocketMessage {
  type: string;
  payload: {
    userId: string;
    x: number;
    y: number;
    spawn?: { x: number; y: number };
    users?: User[];
    token?: string;
    spaceId?: string;
  };
}

const Arena = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [params, setParams] = useState<{ token: string; spaceId: string }>({
    token: '',
    spaceId: '',
  });

  // Initialize WebSocket connection and handle URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token') || '';
    const spaceId = urlParams.get('spaceId') || '';
    setParams({ token, spaceId });

    // Initialize WebSocket
    wsRef.current = new WebSocket('ws://localhost:3001'); // Replace with your WS_URL

    wsRef.current.onopen = () => {
      // Join the space once connected
      wsRef.current?.send(
        JSON.stringify({
          type: 'join',
          payload: {
            spaceId,
            token,
          },
        })
      );
    };

    wsRef.current.onmessage = (event: MessageEvent) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'space-joined':
        // Initialize current user position and other users
        setCurrentUser({
          x: message.payload.spawn!.x,
          y: message.payload.spawn!.y,
          userId: message.payload.userId,
        });

        // Initialize other users from the payload
        const userMap = new Map<string, User>();
        message.payload.users?.forEach((user) => {
          userMap.set(user.userId, user);
        });
        setUsers(userMap);
        break;

      case 'user-joined':
        setUsers((prev) => {
          const newUsers = new Map(prev);
          newUsers.set(message.payload.userId, {
            x: message.payload.x,
            y: message.payload.y,
            userId: message.payload.userId,
          });
          return newUsers;
        });
        break;

      case 'movement':
        setUsers((prev) => {
          const newUsers = new Map(prev);
          const user = newUsers.get(message.payload.userId);
          if (user) {
            user.x = message.payload.x;
            user.y = message.payload.y;
            newUsers.set(message.payload.userId, user);
          }
          return newUsers;
        });
        break;

      case 'movement-rejected':
        // Reset current user position if movement was rejected
        setCurrentUser((prev) => ({
          ...prev!,
          x: message.payload.x,
          y: message.payload.y,
        }));
        break;

      case 'user-left':
        setUsers((prev) => {
          const newUsers = new Map(prev);
          newUsers.delete(message.payload.userId);
          return newUsers;
        });
        break;
    }
  };

  // Handle user movement
  const handleMove = (newX: number, newY: number) => {
    if (!currentUser) return;

    // Send movement request
    wsRef.current?.send(
      JSON.stringify({
        type: 'move',
        payload: {
          x: newX,
          y: newY,
          userId: currentUser.userId,
        },
      })
    );
  };

  // Draw the arena
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#eee';
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Draw current user
    if (currentUser) {
      ctx.beginPath();
      ctx.fillStyle = '#FF6B6B';
      ctx.arc(currentUser.x * 50, currentUser.y * 50, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('You', currentUser.x * 50, currentUser.y * 50 + 40);
    }

    // Draw other users
    users.forEach((user) => {
      ctx.beginPath();
      ctx.fillStyle = '#4ECDC4';
      ctx.arc(user.x * 50, user.y * 50, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`User ${user.userId}`, user.x * 50, user.y * 50 + 40);
    });
  }, [currentUser, users]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!currentUser) return;

    const { x, y } = currentUser;
    switch (e.key) {
      case 'ArrowUp':
        handleMove(x, y - 1);
        break;
      case 'ArrowDown':
        handleMove(x, y + 1);
        break;
      case 'ArrowLeft':
        handleMove(x - 1, y);
        break;
      case 'ArrowRight':
        handleMove(x + 1, y);
        break;
    }
  };

  return (
    <div className="p-4" onKeyDown={handleKeyDown} tabIndex={0}>
      <h1 className="text-2xl font-bold mb-4">Metaverse</h1>
      <div className="mb-4">
        <p className="text-sm text-gray-600">Token: {params.token}</p>
        <p className="text-sm text-gray-600">Space ID: {params.spaceId}</p>
        <p className="text-sm text-gray-600">Connected Users: {users.size + (currentUser ? 1 : 0)}</p>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <canvas ref={canvasRef} width={1000} height={1000} className="bg-white" />
      </div>
      <p className="mt-2 text-sm text-gray-500">Use arrow keys to move your avatar</p>
    </div>
  );
};

export default Arena;