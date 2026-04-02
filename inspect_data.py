import pandas as pd

df = pd.read_csv('data/Train.csv', nrows=5)
print("=== TRAIN.CSV COLUMNS ===")
for col in df.columns:
    print(f"  {col}: {df[col].dtype} | sample: {df[col].iloc[0]}")

print("\n=== UNIQUE VALUES FOR CATEGORICALS ===")
for col in ['Warehouse_block', 'Mode_of_Shipment', 'Product_importance', 'Gender']:
    print(f"  {col}: {df[col].unique()}")
