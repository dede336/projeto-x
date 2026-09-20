import { ElementId } from '@/constants/gameData';
import { ImageSourcePropType } from 'react-native';

const ELEMENT_IMAGES: Partial<Record<ElementId, ImageSourcePropType>> = {
  FIRE:      require('../assets/images/elements/fogo.webp'),
  WATER:     require('../assets/images/elements/agua.webp'),
  PLANT:     require('../assets/images/elements/planta.webp'),
  EARTH:     require('../assets/images/elements/terra.webp'),
  ICE:       require('../assets/images/elements/gelo.webp'),
  DARK:      require('../assets/images/elements/trevas.webp'),
  LIGHT:     require('../assets/images/elements/luz.webp'),
  LIGHTNING: require('../assets/images/elements/trovao.webp'),
  WIND:      require('../assets/images/elements/vento.webp'),
  METAL:     require('../assets/images/elements/metal.webp'),
  NULL:      require('../assets/images/elements/nulo.webp'),
};

export default ELEMENT_IMAGES;
