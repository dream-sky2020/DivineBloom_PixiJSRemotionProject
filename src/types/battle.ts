/**
 * 战斗相关的数据类型定义
 */

export interface Character {
  /** 唯一标识符 */
  id: string;
  /** 姓名 */
  name: string;
  /** 血量 */
  hp: number;
  /** 平衡 */
  balance: number;
}

export interface Coin {
  /** 正面值 */
  frontValue: number;
  /** 负面值 */
  backValue: number;
  /** 是否被摧毁 */
  isDestroyed: boolean;
  /** 当前面：正面、反面或尚未决定 */
  side: 'front' | 'back' | 'undecided';
  /** 当前值 */
  currentValue: number;
}

export interface BattleAnimation {
  /** 唯一标识符 */
  id: string;
  /** 名称 */
  name: string;
  /** 站立资源id */
  idleResourceId: string;
  /** 前进资源id */
  forwardResourceId: string;
  /** 后退资源id */
  backwardResourceId: string;
  /** 攻击前摇id */
  preAttackResourceId: string;
  /** 攻击后摇id */
  postAttackResourceId: string;
}
