import { AttributeId } from '@/constants/gameData';
import { ImageSourcePropType } from 'react-native';

const ATTRIBUTE_IMAGES: Partial<Record<AttributeId, ImageSourcePropType>> = {
  VC: require('../assets/images/attributes/vacina.webp'),
  VR: require('../assets/images/attributes/virus.webp'),
  DA: require('../assets/images/attributes/data.webp'),
  UN: require('../assets/images/attributes/desconhecido.webp'),
  FR: require('../assets/images/attributes/livre.webp'),
};

export default ATTRIBUTE_IMAGES;
