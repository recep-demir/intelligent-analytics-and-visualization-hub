import { Sequelize, DataTypes, Model } from 'sequelize';
import path from 'path';
import { extendTypes } from 'graphql-gene';
import type { UserRole } from './src/auth/types';


const storagePath = process.env.NODE_ENV === 'test' 
  ? ':memory:' 
  : path.resolve(__dirname, 'database.sqlite');

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: storagePath,
  logging: false
});

export class Product extends Model {
  declare id: number;
  declare name: string;
}

Product.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    }
  },
  {
    sequelize,
    modelName: 'Product',
    tableName: 'Products',
    timestamps: false
  }
);

export class User extends Model {
  declare id: number;
  declare email: string;
  declare passwordHash: string;
  declare role: UserRole;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'viewer',
      validate: {
        isIn: [['admin', 'analyst', 'viewer']]
      }
    }
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'Users',
    timestamps: true
  }
);

try {
  extendTypes({
    Query: {
      products: {
        resolver: 'default',
        returnType: '[Product!]' as any,
      },
    },
  });
} catch (error) {
  console.warn('⚠️ Failed to extend GraphQL types:', error);
}