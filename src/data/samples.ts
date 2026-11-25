import meadowImg from '../assets/images/sample_meadow_portrait_1795557707314.jpg';
import coastalImg from '../assets/images/sample_coastal_golden_1795557708040.jpg';
import gardenImg from '../assets/images/sample_garden_flowers_1795557707795.jpg';
import terraceImg from '../assets/images/sample_terrace_cafe_1795557708482.jpg';
import { SamplePhoto } from '../types/editor';

export const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    id: 'meadow',
    label: 'Overcast Meadow',
    src: meadowImg,
    aspectLabel: '3:4',
  },
  {
    id: 'coastal',
    label: 'Coastal Breeze',
    src: coastalImg,
    aspectLabel: '3:4',
  },
  {
    id: 'plumeria',
    label: 'Plumeria Bloom',
    src: gardenImg,
    aspectLabel: '3:4',
  },
  {
    id: 'terrace',
    label: 'Terrace Cafe',
    src: terraceImg,
    aspectLabel: '3:4',
  },
];
