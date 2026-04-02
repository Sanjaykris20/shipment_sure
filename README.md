# ShipmentSure: Predicting On-Time Delivery Using Supplier Data

## Project Overview
This project aims to develop a machine learning model that predicts whether an order will reach the customer on time based on various supplier-related and order-related factors. This will help manufacturing or logistics firms evaluate operational reliability and plan corrective actions in procurement and delivery systems.

## Dataset
- **Source**: Kaggle – Supply Chain Logistics Dataset
- **Link**: https://www.kaggle.com/datasets/prachi13/customer-analytics
- **File**: `data/Train.csv`

## Project Outcome
- A classification model that predicts whether a shipment will be delayed or arrive on time.
- Insights into which features most influence on-time delivery.
- A dashboard or user interface for real-time prediction (future work).

## Project Workflow
1. Data Collection and Understanding
2. Exploratory Data Analysis (EDA)
3. Data Preprocessing
4. Feature Engineering
5. Model Building
6. Model Evaluation
7. Deployment and Documentation

## Week-wise Module Implementation and Milestones

### Milestone 1: Week 1–2
**Module**: Data Understanding and Exploration
- Understand dataset schema and data types
- Perform univariate and bivariate analysis
- Visualize feature distributions and relationships
- Examine class imbalance in `Reached.on.Time_Y.N`
**Deliverables**:
- Annotated Jupyter notebook for EDA
- Initial insights and EDA visualizations

### Milestone 2: Week 3–4
**Module**: Data Preprocessing and Feature Engineering
- Handle missing values and outliers
- Encode categorical variables
- Engineer new features
- Prepare data for modeling

## Installation
1. Clone or download the project.
2. Install dependencies: `pip install -r requirements.txt`
3. Run the notebooks in order: EDA.ipynb, EDA_2.ipynb, data_visualization.ipynb, preprocessing.ipynb, encoding.ipynb, feature_engineering.ipynb, logistic_regression.ipynb, random_forest.ipynb, xgboost.ipynb, model_evaluation.ipynb

## Project Structure
```
ShipmentSure/
├── data/
│   └── Train.csv
├── notebooks/
│   ├── EDA.ipynb
│   ├── EDA_2.ipynb
│   ├── data_visualization.ipynb
│   ├── preprocessing.ipynb
│   ├── encoding.ipynb
│   ├── feature_engineering.ipynb
│   ├── logistic_regression.ipynb
│   ├── random_forest.ipynb
│   ├── xgboost.ipynb
│   ├── model_evaluation.ipynb
├── models/
│   └── best_model.pkl
├── requirements.txt
└── README.md
```