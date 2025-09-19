
'use client';

import Image from 'next/image';
import Link from 'next/link';

// Компонент для короткого видео
const ShortVideoPlayer = ({ index, poster }: { index: number; poster: string }) => {
  return (
    <Link href={`/shorts?index=${index}`}>
      <div className="flex-shrink-0 w-36 cursor-pointer">
        <div className="bg-gray-200 rounded overflow-hidden relative aspect-[9/16]" style={{ borderRadius: '4px' }}>
          <Image
            src={poster}
            alt={`Short video ${index + 1}`}
            fill
            className="object-cover"
            sizes="144px"
          />
        </div>
      </div>
    </Link>
  );
};

const HomePage = () => {
  return (
    <div className="bg-[#060919] min-h-screen text-white pb-32">
      <Header />
      
      {/* Секция с короткими видео (треньки) */}
      <TrenkiSection />
      
      {/* Основное обучающее видео */}
      <HeroVideoSection />
      
      {/* Каталог тренировок */}
      <TrainingsSection />
      
      {/* Список тренеров */} 
      <TrainersSection />
      
      {/* Промо-баннер */}
      <PromoBannerSection />
      
      {/* Нижнее меню */}
      <BottomNavigation />
    </div>
  );
};

const Header = () => (
  <header style={{
    width: '100%', 
    paddingBottom: 24, 
    paddingLeft: 16, 
    paddingRight: 16, 
    paddingTop: 100,
    borderBottom: '1px #101530 solid', 
    flexDirection: 'column', 
    justifyContent: 'flex-start', 
    alignItems: 'flex-start', 
    gap: 12, 
    display: 'flex'
  }}>
    <div style={{
      width: '100%', 
      justifyContent: 'flex-start', 
      alignItems: 'center', 
      gap: 4, 
      display: 'flex'
    }}>
      <div style={{
        width: 40, 
        paddingTop: 4, 
        paddingBottom: 4, 
        overflow: 'hidden', 
        borderRadius: 2, 
        flexDirection: 'column', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        display: 'flex'
      }}>
        <div style={{
          textAlign: 'center', 
          color: '#F9F8FE', 
          fontSize: 24, 
          fontFamily: 'Overpass', 
          fontWeight: '700', 
          lineHeight: '24px'
        }}>88</div>
        <div style={{
          textAlign: 'center', 
          color: '#F9F8FE', 
          fontSize: 12, 
          fontFamily: 'Overpass', 
          fontWeight: '700', 
          lineHeight: '12px', 
          letterSpacing: 0.50
        }}>вр</div>
      </div>
      <div style={{
        flex: '1 1 0', 
        padding: 4, 
        borderRadius: 2, 
        flexDirection: 'column', 
        justifyContent: 'flex-start', 
        alignItems: 'flex-start', 
        display: 'flex'
      }}>
        <div style={{
          width: '100%', 
          paddingTop: 4, 
          paddingBottom: 4, 
          justifyContent: 'flex-start', 
          alignItems: 'center', 
          gap: 10, 
          display: 'flex'
        }}>
          <div style={{
            flex: '1 1 0', 
            color: '#F9F8FE', 
            fontSize: 16, 
            fontFamily: 'Overpass', 
            fontWeight: '700', 
            textTransform: 'uppercase', 
            lineHeight: '16px', 
            letterSpacing: 0.50
          }}>Константин</div>
        </div>
        <div style={{
          width: '100%', 
          paddingTop: 4, 
          paddingBottom: 4, 
          justifyContent: 'flex-start', 
          alignItems: 'center', 
          gap: 10, 
          display: 'flex'
        }}>
          <div style={{
            flex: '1 1 0', 
            color: '#F9F8FE', 
            fontSize: 16, 
            fontFamily: 'Overpass', 
            fontWeight: '700', 
            textTransform: 'uppercase', 
            lineHeight: '16px', 
            letterSpacing: 0.50
          }}>Константинопольский</div>
        </div>
      </div>
      <Image 
        src="/logos/logo_akb.png" 
        alt="Avatar" 
        width={48} 
        height={48} 
        style={{borderRadius: 1}}
        className="object-cover"
      />
    </div>
    <div style={{
      width: '100%', 
      justifyContent: 'flex-start', 
      alignItems: 'center', 
      gap: 4, 
      display: 'flex'
    }}>
      <Image 
        src="/icons/ant-design-thunderbolt-filled.svg" 
        alt="Потенциал" 
        width={16} 
        height={16} 
        style={{ alignSelf: 'center' }}
      />
      <div style={{
        color: '#F9F8FE', 
        fontSize: 12, 
        fontFamily: 'Overpass', 
        fontStyle: 'italic', 
        fontWeight: '800', 
        textTransform: 'uppercase', 
        lineHeight: '12px', 
        letterSpacing: 0.50,
        alignSelf: 'center'
      }}>потенциал:</div>
      <div style={{
        flex: '1 1 0', 
        height: 12, 
        position: 'relative',
        alignSelf: 'center'
      }}>
        <div style={{
          color: '#A1FF4A', 
          fontSize: 12, 
          fontFamily: 'Overpass', 
          fontStyle: 'italic', 
          fontWeight: '800', 
          textTransform: 'uppercase', 
          lineHeight: '12px', 
          letterSpacing: 0.50
        }}>высокий</div>
      </div>
    </div>
  </header>
);

const HeroVideoSection = () => (
  <section className="px-4" style={{ paddingBottom: '15px' }}>
    <Link href="/video/onboarding">
      <div className="bg-red-500 overflow-hidden relative h-[193px] w-full cursor-pointer hover:opacity-90 transition-opacity" style={{ borderRadius: '4px' }}>
        <Image src="/images/video_inbording.png" alt="Onboarding" layout="fill" className="object-cover" />
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
          8:44
        </div>
      </div>
    </Link>
  </section>
);

const TrenkiSection = () => (
  <section style={{ paddingTop: '15px', paddingBottom: '15px' }}>
    <div className="flex space-x-4 overflow-x-auto pb-4 px-4">
      <ShortVideoPlayer index={0} poster="/images/preview_shorts/shorts_1.png" />
      <ShortVideoPlayer index={1} poster="/images/preview_shorts/shorts_2.png" />
      <ShortVideoPlayer index={2} poster="/images/preview_shorts/shorts_3.png" />
      <ShortVideoPlayer index={3} poster="/images/preview_shorts/shorts_4.png" />
    </div>
  </section>
);

const TrainingsSection = () => (
    <section className="px-4" style={{ paddingBottom: '15px' }}>
        <div style={{width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 8, display: 'inline-flex'}}>
            <div style={{flex: '1 1 0', alignSelf: 'stretch', paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, background: 'linear-gradient(180deg, rgba(87, 108, 255, 0) 0%, rgba(87, 108, 255, 0.50) 100%)', overflow: 'hidden', borderRadius: 8, flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 8, display: 'inline-flex'}}>
                <Image 
                    src="/icons/icon-cards.svg" 
                    alt="ИИ тренер" 
                    width={16} 
                    height={16}
                />
                <div style={{alignSelf: 'stretch'}}>
                    <div style={{color: '#F9F8FE', fontSize: 14, fontFamily: 'Overpass', fontWeight: '700', textTransform: 'uppercase', lineHeight: '120%', letterSpacing: 0.50, wordWrap: 'break-word'}}>
                        персональный <span style={{color: '#A1FF4A'}}>ИИ</span> тренер
                    </div>
                </div>
            </div>
            <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'inline-flex'}}>
                <div style={{alignSelf: 'stretch', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, background: 'rgba(68, 92, 255, 0.20)', overflow: 'hidden', borderRadius: 8, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'flex'}}>
                    <Image 
                        src="/icons/ant-design-thunderbolt-filled_f.svg" 
                        alt="Потенциал" 
                        width={16} 
                        height={16}
                    />
                    <div style={{width: 146, color: '#F9F8FE', fontSize: 14, fontFamily: 'Overpass', fontWeight: '700', textTransform: 'uppercase', lineHeight: '120%', letterSpacing: 0.50, wordWrap: 'break-word'}}>повышение потенциала</div>
                </div>
                <div style={{alignSelf: 'stretch', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, background: 'rgba(68, 92, 255, 0.20)', overflow: 'hidden', borderRadius: 8, flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8, display: 'flex'}}>
                    <Image 
                        src="/icons/icon-cards-kl.svg" 
                        alt="Треньки" 
                        width={16} 
                        height={16}
                    />
                    <div style={{alignSelf: 'stretch', color: '#F9F8FE', fontSize: 14, fontFamily: 'Overpass', fontWeight: '700', textTransform: 'uppercase', lineHeight: '120%', letterSpacing: 0.50, wordWrap: 'break-word'}}>треньки, советы профи, разборы</div>
                </div>
            </div>
        </div>
    </section>
);

const TrainersSection = () => (
    <section style={{ paddingBottom: '15px' }}>
        <div style={{
            width: '100%', 
            height: '100%', 
            paddingLeft: 16, 
            paddingRight: 16, 
            paddingTop: 24, 
            paddingBottom: 24, 
            background: 'linear-gradient(180deg, #101530 0%, #060919 100%)', 
            borderRadius: 1, 
            flexDirection: 'column', 
            justifyContent: 'flex-start', 
            alignItems: 'flex-start', 
            gap: 16, 
            display: 'inline-flex'
        }}>
            <div style={{
                alignSelf: 'stretch', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                display: 'inline-flex'
            }}>
                <div style={{
                    color: '#F9F8FE', 
                    fontSize: 12, 
                    fontFamily: 'Overpass', 
                    fontWeight: '700', 
                    textTransform: 'uppercase', 
                    lineHeight: '14.40px', 
                    letterSpacing: 0.50
                }}>тренеры</div>
                <div style={{
                    width: 16, 
                    height: 16, 
                    position: 'relative', 
                    overflow: 'hidden'
                }}>
                    <Link href="/trainers">
                        <Image 
                            src="/icons/arrow.svg" 
                            alt="Стрелка" 
                            width={16} 
                            height={16}
                        />
                    </Link>
                </div>
            </div>
            <div style={{
                alignSelf: 'stretch', 
                justifyContent: 'flex-start', 
                alignItems: 'center', 
                gap: 16, 
                display: 'inline-flex'
            }}>
                {/* Карточка Марка */}
                <div style={{
                    width: '50%', 
                    height: 202, 
                    paddingBottom: 8, 
                    background: '#060919', 
                    overflow: 'hidden', 
                    borderRadius: 8, 
                    flexDirection: 'column', 
                    justifyContent: 'flex-start', 
                    alignItems: 'flex-start', 
                    display: 'inline-flex'
                }}>
                    <div style={{
                        width: '100%', 
                        height: 112, 
                        position: 'relative', 
                        background: 'linear-gradient(180deg, rgba(87, 108, 255, 0) 0%, rgba(87, 108, 255, 0.50) 100%)', 
                        overflow: 'hidden',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        <Image 
                            src="/avatars/af9e5de293f8ce1c351f480e9af666a6453ed701.png" 
                            alt="Марк" 
                            width={100}
                            height={100}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                        <div style={{
                            width: 24, 
                            height: 24, 
                            left: 4, 
                            top: 4, 
                            position: 'absolute',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            <Image 
                                src="/icons/star-6.svg" 
                                alt="Звезда рейтинга" 
                                width={24} 
                                height={24}
                                style={{ position: 'absolute' }}
                            />
                            <div style={{
                                position: 'relative',
                                zIndex: 1,
                                justifyContent: 'center', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                color: '#A1FF4A', 
                                fontSize: 10, 
                                fontFamily: 'Overpass', 
                                fontWeight: '400', 
                                textTransform: 'uppercase', 
                                lineHeight: '10px', 
                                letterSpacing: 0.50
                            }}>5</div>
                        </div>
                    </div>
                    <div style={{
                        alignSelf: 'stretch', 
                        padding: 8, 
                        flexDirection: 'column', 
                        justifyContent: 'center', 
                        alignItems: 'flex-start', 
                        gap: 8, 
                        display: 'flex'
                    }}>
                        <div style={{
                            alignSelf: 'stretch', 
                            color: '#445CFF', 
                            fontSize: 14, 
                            fontFamily: 'Overpass', 
                            fontWeight: '700', 
                            textTransform: 'uppercase', 
                            lineHeight: '14px', 
                            letterSpacing: 0.50,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>марк</div>
                        <div style={{
                            alignSelf: 'stretch', 
                            color: '#445CFF', 
                            fontSize: 14, 
                            fontFamily: 'Overpass', 
                            fontWeight: '700', 
                            textTransform: 'uppercase', 
                            lineHeight: '14px', 
                            letterSpacing: 0.50,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>ковалевский</div>
                    </div>
                    <div style={{
                        alignSelf: 'stretch', 
                        padding: 8, 
                        borderTop: '1px rgba(38, 37, 47, 0.50) solid', 
                        justifyContent: 'flex-start', 
                        alignItems: 'center', 
                        gap: 10, 
                        display: 'inline-flex'
                    }}>
                        <div style={{
                            flex: '1 1 0', 
                            justifyContent: 'center', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            color: '#F9F8FE', 
                            fontSize: 12, 
                            fontFamily: 'Overpass', 
                            fontWeight: '700', 
                            textTransform: 'uppercase', 
                            lineHeight: '12px', 
                            letterSpacing: 0.50
                        }}>Главный тренер</div>
                    </div>
                </div>
                
                {/* Карточка Константина */}
                <div style={{
                    width: '50%', 
                    height: 202, 
                    paddingBottom: 8, 
                    background: '#060919', 
                    overflow: 'hidden', 
                    borderRadius: 8, 
                    flexDirection: 'column', 
                    justifyContent: 'flex-start', 
                    alignItems: 'flex-start', 
                    display: 'inline-flex'
                }}>
                    <div style={{
                        width: '100%', 
                        height: 112, 
                        position: 'relative', 
                        background: 'linear-gradient(180deg, rgba(87, 108, 255, 0) 0%, rgba(87, 108, 255, 0.50) 100%)', 
                        overflow: 'hidden',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center'
                    }}>
                        <Image 
                            src="/avatars/af9e5de293f8ce1c351f480e9af666a6453ed701.png" 
                            alt="Константин" 
                            width={100}
                            height={100}
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                        <div style={{
                            width: 24, 
                            height: 24, 
                            left: 4, 
                            top: 4, 
                            position: 'absolute',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            <Image 
                                src="/icons/star-6.svg" 
                                alt="Звезда рейтинга" 
                                width={24} 
                                height={24}
                                style={{ position: 'absolute' }}
                            />
                            <div style={{
                                position: 'relative',
                                zIndex: 1,
                                justifyContent: 'center', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                color: '#A1FF4A', 
                                fontSize: 10, 
                                fontFamily: 'Overpass', 
                                fontWeight: '400', 
                                textTransform: 'uppercase', 
                                lineHeight: '10px', 
                                letterSpacing: 0.50
                            }}>5</div>
                        </div>
                    </div>
                    <div style={{
                        alignSelf: 'stretch', 
                        padding: 8, 
                        flexDirection: 'column', 
                        justifyContent: 'center', 
                        alignItems: 'flex-start', 
                        gap: 8, 
                        display: 'flex'
                    }}>
                        <div style={{
                            alignSelf: 'stretch', 
                            color: '#445CFF', 
                            fontSize: 14, 
                            fontFamily: 'Overpass', 
                            fontWeight: '700', 
                            textTransform: 'uppercase', 
                            lineHeight: '14px', 
                            letterSpacing: 0.50,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>константин</div>
                        <div style={{
                            alignSelf: 'stretch', 
                            color: '#445CFF', 
                            fontSize: 14, 
                            fontFamily: 'Overpass', 
                            fontWeight: '700', 
                            textTransform: 'uppercase', 
                            lineHeight: '14px', 
                            letterSpacing: 0.50,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                        }}>константинопольский</div>
                    </div>
                    <div style={{
                        alignSelf: 'stretch', 
                        padding: 8, 
                        borderTop: '1px #26252F solid', 
                        justifyContent: 'flex-start', 
                        alignItems: 'center', 
                        gap: 10, 
                        display: 'inline-flex'
                    }}>
                        <div style={{
                            flex: '1 1 0', 
                            justifyContent: 'center', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            color: '#F9F8FE', 
                            fontSize: 12, 
                            fontFamily: 'Overpass', 
                            fontWeight: '700', 
                            textTransform: 'uppercase', 
                            lineHeight: '12px', 
                            letterSpacing: 0.50
                        }}>вратарский</div>
                    </div>
                </div>
            </div>
        </div>
    </section>
);

const PromoBannerSection = () => (
    <section className="px-4">
        <div className="bg-[#2d3448] rounded-lg overflow-hidden relative h-48 border border-[#3d4759]">
            <Image src="/images/video_prew_2.png" alt="Promo" layout="fill" className="object-cover" />
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                8:44
            </div>
        </div>
    </section>
);

const BottomNavigation = () => (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#101530] border-t border-[#2d3448] px-4 py-3 z-50">
        <div className="flex justify-around items-center max-w-md mx-auto">
            <button className="flex flex-col items-center gap-1 p-2">
                <Image src="/icons/tapbar/icon-type-home-active-yes.svg" alt="Главная" width={28} height={28} />
                <span className="text-xs text-[#445CFF]">Главная</span>
            </button>
            
            <button className="flex flex-col items-center gap-1 p-2">
                <Image src="/icons/tapbar/icon-type-play-active-no.svg" alt="Видео" width={28} height={28} />
                <span className="text-xs text-[#8892b0]">Видео</span>
            </button>
            
            <button className="flex flex-col items-center gap-1 p-2">
                <Image src="/icons/tapbar/icon-type-hockey-active-no.svg" alt="Треньки" width={28} height={28} />
                <span className="text-xs text-[#8892b0]">Треньки</span>
            </button>
            
            <button className="flex flex-col items-center gap-1 p-2">
                <Image src="/icons/tapbar/icon-type-calendar-active-no.svg" alt="Расписание" width={28} height={28} />
                <span className="text-xs text-[#8892b0]">Расписание</span>
            </button>
            
            <Link href="/profile" className="flex flex-col items-center gap-1 p-2">
                <Image src="/icons/tapbar/icon-type-hockey-mask-active-no.svg" alt="Профиль" width={28} height={28} />
                <span className="text-xs text-[#8892b0]">Профиль</span>
            </Link>
        </div>
    </nav>
);


export default HomePage;
