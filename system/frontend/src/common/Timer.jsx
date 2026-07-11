import '../App.css';
import socket from './websocket';
import { useEffect, useState } from 'react';

export default function Timer() {
  const [timeLeft, setTimeLeft] = useState(-1);

  useEffect(() => {
    // Listen for backend updates on the timer
    const handleTimerUpdate = (data) => {
      setTimeLeft(data.time_left);
    };

    socket.on('update_timer', handleTimerUpdate);

    return () => {
      socket.off('update_timer', handleTimerUpdate);
    };
  }, []);
  // useEffect(() => {
  //   if (timeLeft === 0) {
  //     alert("Time's up! Please submit your answer.");
  //   }
  // }, [timeLeft]);

  return (
    <div className="flex font-inter text-center bg-black text-white rounded-[0.5rem] border-black border-[0.063rem] gap-x-1 sm:gap-x-2 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-base lg:text-[1.25rem] font-semibold items-center whitespace-nowrap">
      <i className="fa-regular fa-clock"></i>
      {timeLeft < 0 ? <p>No Time Limit</p> : <p>{`${timeLeft}s left`}</p>}
    </div>
  );
}
