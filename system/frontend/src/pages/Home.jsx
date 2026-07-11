import '../App.css';
import Container from '../common/Container';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-svh flex flex-col font-inter">
      <div className="main-container flex-1 mt-8 sm:mt-12 md:mt-20">
        <Container>
          <div className="h-full flex flex-col items-center justify-center text-center py-10 px-4">
            <div className="font-gooper [-webkit-text-stroke:1.5px_black] bg-gradient-to-r from-[#5FB1E0] to-[#FAF8E0] inline-block text-transparent bg-clip-text font-semibold text-[2.25rem] sm:text-[3rem] md:text-[4rem] drop-shadow-[5px_5px_0px_rgba(0,0,0,1)] mb-4 sm:mb-6">
              ImaginAItion
            </div>
            <div className="font-inter text-[1.125rem] sm:text-[1.5rem] md:text-[32px] text-[#5A5A5A] mb-10 sm:mb-14 md:mb-20">
              A generative AI drawing and guessing game
            </div>
            <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-4 mb-8 w-full max-w-xs sm:max-w-none">
              {/* Add links to the Start Game, Join Game, and How to Play pages. */}
              <Link to="/start" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto font-gooper font-medium border border-black rounded-xl text-[1.25rem] sm:text-[1.5rem] md:text-[2rem] px-6 sm:px-8 pb-3 pt-3 bg-[#D7E5FF]">
                  Start Game
                </button>
              </Link>
              <Link to="/join" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto font-gooper font-medium border border-black rounded-xl text-[1.25rem] sm:text-[1.5rem] md:text-[2rem] px-6 sm:px-8 pb-3 pt-3 bg-[#D7E5FF]">
                  Join Game
                </button>
              </Link>
            </div>
            <div className="flex flex-col items-center gap-4 w-full max-w-xs sm:max-w-none">
              <Link to="/how-to-play" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto font-gooper font-medium border border-black rounded-xl text-[1.25rem] sm:text-[1.5rem] md:text-[2rem] px-6 sm:px-8 pb-3 pt-3 bg-[#EAEAEA]">
                  How to Play
                </button>
              </Link>
              <Link to="/tutorial" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto font-gooper font-medium border border-black rounded-xl text-[1.25rem] sm:text-[1.5rem] md:text-[2rem] px-6 sm:px-8 pb-3 pt-3 bg-[#EAEAEA]">
                  Game Tutorial
                </button>
              </Link>
            </div>
          </div>
        </Container>
      </div>
    </div>
  );
}
