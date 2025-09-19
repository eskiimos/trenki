import Image from 'next/image';

interface TrainerProps {
  trainer: {
    id: string;
    name: string;
    lastName: string;
    speciality: string;
    rating: number;
    avatar: string | null;
  };
}

export default function TrainerCard({ trainer }: TrainerProps) {
  // Используем аватар из БД или запасной
  const avatarSrc = trainer.avatar || '/avatars/af9e5de293f8ce1c351f480e9af666a6453ed701.png';
  
  return (
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
          src={avatarSrc} 
          alt={`${trainer.name} ${trainer.lastName}`} 
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
          }}>{trainer.rating}</div>
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
        }}>{trainer.name}</div>
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
        }}>{trainer.lastName}</div>
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
        }}>{trainer.speciality}</div>
      </div>
    </div>
  );
}
