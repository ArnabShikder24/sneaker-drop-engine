import {
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  NonAttribute,
} from 'sequelize';
import { sequelize } from '../../config/db';

// ─── Drop ────────────────────────────────────────────────────────────────────

export class Drop extends Model<
  InferAttributes<Drop>,
  InferCreationAttributes<Drop>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  /** Price in smallest currency unit (cents) or as decimal — stored as DECIMAL(10,2) */
  declare price: number;
  declare total_stock: number;
  /** Single source of truth for current available units. Atomically updated. */
  declare available_stock: number;
  declare starts_at: Date;
  declare created_at: CreationOptional<Date>;

  // Virtual association fields (populated by eager loading)
  declare purchases?: NonAttribute<Purchase[]>;
}

Drop.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    total_stock: { type: DataTypes.INTEGER, allowNull: false },
    available_stock: { type: DataTypes.INTEGER, allowNull: false },
    starts_at: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'drops',
    timestamps: false,
    indexes: [{ fields: ['starts_at'] }],
  },
);

// ─── User ────────────────────────────────────────────────────────────────────

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: CreationOptional<number>;
  declare username: string;
  declare created_at: CreationOptional<Date>;
}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: false,
  },
);

// ─── Reservation ─────────────────────────────────────────────────────────────

export type ReservationStatus = 'active' | 'expired' | 'completed';

export class Reservation extends Model<
  InferAttributes<Reservation>,
  InferCreationAttributes<Reservation>
> {
  declare id: CreationOptional<number>;
  declare drop_id: ForeignKey<Drop['id']>;
  declare user_id: ForeignKey<User['id']>;
  declare status: ReservationStatus;
  /** UTC timestamp after which this reservation is considered expired */
  declare expires_at: Date;
  declare created_at: CreationOptional<Date>;
}

Reservation.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    drop_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.ENUM('active', 'expired', 'completed'),
      allowNull: false,
      defaultValue: 'active',
    },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'reservations',
    timestamps: false,
    indexes: [
      // The expiration sweep queries on (status, expires_at) — this index makes it fast
      { fields: ['status', 'expires_at'] },
    ],
  },
);

// ─── Purchase ────────────────────────────────────────────────────────────────

export class Purchase extends Model<
  InferAttributes<Purchase>,
  InferCreationAttributes<Purchase>
> {
  declare id: CreationOptional<number>;
  declare drop_id: ForeignKey<Drop['id']>;
  declare user_id: ForeignKey<User['id']>;
  declare reservation_id: ForeignKey<Reservation['id']>;
  declare created_at: CreationOptional<Date>;

  // Populated by eager loading in listDrops
  declare user?: NonAttribute<User>;
}

Purchase.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    drop_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    reservation_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'purchases',
    timestamps: false,
    indexes: [
      // The activity feed query orders by (drop_id, created_at DESC) — index covers it
      { fields: ['drop_id', 'created_at'] },
    ],
  },
);

// ─── Associations ─────────────────────────────────────────────────────────────

Drop.hasMany(Reservation, { foreignKey: 'drop_id', as: 'reservations' });
Reservation.belongsTo(Drop, { foreignKey: 'drop_id', as: 'drop' });

Drop.hasMany(Purchase, { foreignKey: 'drop_id', as: 'purchases' });
Purchase.belongsTo(Drop, { foreignKey: 'drop_id', as: 'drop' });

User.hasMany(Reservation, { foreignKey: 'user_id', as: 'reservations' });
Reservation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Purchase, { foreignKey: 'user_id', as: 'purchases' });
Purchase.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Reservation.hasOne(Purchase, { foreignKey: 'reservation_id', as: 'purchase' });
Purchase.belongsTo(Reservation, { foreignKey: 'reservation_id', as: 'reservation' });

export { sequelize };