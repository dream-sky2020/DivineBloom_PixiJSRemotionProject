// 基础系统接口
export interface ISystem {
    name: string;
    enabled: boolean;
    update(deltaTime: number): void;
}