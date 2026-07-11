import '../App.css';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import TopBar from '../common/TopBar';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';

const SCOREBOARD_GRID_COLS = 'grid-cols-[2.5rem_1fr_auto]';

export function Player({ rank, name, totalPoints }) {
  return (
    <div className={`bg-white rounded-b-[0.75rem] gap-[0.625rem] py-3 sm:py-[1.5268rem] px-4 sm:px-[1.9rem] text-base sm:text-[1.25rem] md:text-[1.875rem] grid ${SCOREBOARD_GRID_COLS} font-inter border-white border-[0.5rem] items-center`}>
      <span className="font-semibold text-center">{rank}</span>
      <span className="font-normal text-left truncate">{name}</span>
      <span className="text-[#4E4E4E] text-right">
        {totalPoints} pts
      </span>
    </div>
  );
}

export default function GameResult() {
  const [playerState, setPlayerState] = useState({});
  const [sidToPlayer, setSidToPlayer] = useState({});
  const { gameCode } = useParams();

  useEffect(() => {
    const fetchPlayerState = async () => {
      try {
        const response = await axios.get(
          `/api/game-results?room_id=${gameCode}`
        );
        console.log('Game results response:', response.data);
        setPlayerState(response.data.player_state);
      } catch (error) {
        console.error('Error fetching game results:', error);
      }
    };

    fetchPlayerState();
  }, [gameCode]);

  useEffect(() => {
    const fetchSidToPlayers = async () => {
      try {
        const response = await axios.get(
          `/api/sid-to-players?room_id=${gameCode}`
        );
        console.log('Sid to players response:', response.data);
        setSidToPlayer(response.data);
      } catch (error) {
        console.error('Error fetching sid to players:', error);
      }
    };

    fetchSidToPlayers();
  }, [gameCode]);

  return (
    <div className="min-h-svh justify-items-center">
      {/* <div className="absolute">
        <TopBar />
      </div> */}
      <div className="h-full content-center w-full sm:w-3/4 px-3 sm:px-0 rounded-b-[0.75rem] text-center">
        <div className="font-gooper [-webkit-text-stroke:3px_black] bg-white inline-block text-transparent bg-clip-text font-semibold text-[2rem] sm:text-[2.75rem] md:text-[4rem] mb-6">
          Game Ended
        </div>
        <div className="rounded-t-[0.75rem]">
          <div className={`bg-black rounded-t-[0.75rem] text-white gap-[0.625rem] py-3 sm:py-[1.5268rem] px-4 sm:px-[1.9rem] text-base sm:text-[1.25rem] md:text-[1.875rem] grid ${SCOREBOARD_GRID_COLS} font-gooper font-medium items-center`}>
            <span className="text-center">#</span>
            <span className="text-left">Name</span>
            <span className="text-right">Total</span>
          </div>
          <div className="bg-white h-auto rounded-b-[0.75rem]">
            {Object.entries(playerState).length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                Loading player results...
              </div>
            ) : (
              Object.entries(playerState)
                .map(([sid, data]) => ({
                  sid,
                  name: sidToPlayer[sid] || `Player ${sid}`,
                  totalPoints: data.score || 0,
                }))
                .sort((a, b) => b.totalPoints - a.totalPoints)
                .map((player, index, sortedPlayers) => {
                  // Calculate proper ranking with tied positions
                  // Find the first occurrence of this score to get the correct rank
                  let rank = 1;
                  for (let i = 0; i < sortedPlayers.length; i++) {
                    if (sortedPlayers[i].totalPoints === player.totalPoints) {
                      rank = i + 1;
                      break;
                    }
                  }

                  return (
                    <Player
                      key={player.sid}
                      rank={rank}
                      name={player.name}
                      totalPoints={player.totalPoints}
                    />
                  );
                })
            )}
          </div>
        </div>

        <Link to="/">
          <button className="py-[0.75rem] px-8 sm:px-[4rem] rounded-[0.5rem] font-gooper bg-black text-white gap-[0.625rem] text-[1.25rem] sm:text-[1.5rem] mt-8 sm:mt-[3rem] mb-8">
            Leave
          </button>
        </Link>
      </div>
    </div>
  );
}

Player.propTypes = {
  rank: PropTypes.number.isRequired,
  name: PropTypes.string.isRequired,
  totalPoints: PropTypes.number.isRequired,
};
