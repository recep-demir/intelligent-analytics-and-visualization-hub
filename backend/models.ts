import { Sequelize, DataTypes, Model } from 'sequelize';
import path from 'path';
import { extendTypes } from 'graphql-gene';


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