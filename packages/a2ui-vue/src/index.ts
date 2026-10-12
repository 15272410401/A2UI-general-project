import { type Component } from 'vue'
import Text from './components/Text.vue'
import Image from './components/Image.vue'
import Icon from './components/Icon.vue'
import Video from './components/Video.vue'
import AudioPlayer from './components/AudioPlayer.vue'
import Button from './components/Button.vue'
import TextField from './components/TextField.vue'
import CheckBox from './components/CheckBox.vue'
import ChoicePicker from './components/ChoicePicker.vue'
import Slider from './components/Slider.vue'
import DateTimeInput from './components/DateTimeInput.vue'
import Column from './components/Column.vue'
import Row from './components/Row.vue'
import List from './components/List.vue'
import Card from './components/Card.vue'
import Tabs from './components/Tabs.vue'
import Modal from './components/Modal.vue'
import Divider from './components/Divider.vue'

export interface RenderMap {
  [key: string]: Component
}

export const renderMap: RenderMap = {
  Text,
  Image,
  Icon,
  Video,
  AudioPlayer,
  Button,
  TextField,
  CheckBox,
  ChoicePicker,
  Slider,
  DateTimeInput,
  Column,
  Row,
  List,
  Card,
  Tabs,
  Modal,
  Divider,
}

export {
  Text,
  Image,
  Icon,
  Video,
  AudioPlayer,
  Button,
  TextField,
  CheckBox,
  ChoicePicker,
  Slider,
  DateTimeInput,
  Column,
  Row,
  List,
  Card,
  Tabs,
  Modal,
  Divider,
}

export { normalizeStyle, mergeStyles, type A2uiStyle } from './utils/style'
