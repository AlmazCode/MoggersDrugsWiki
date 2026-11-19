import React from 'react';
export default class ErrorBoundary extends React.Component {
 state={error:false};
 static getDerivedStateFromError(){return {error:true};}
 render(){return this.state.error?<main className="empty-state"><h1>Не удалось открыть страницу</h1><p>Перезагрузи вики. Если ошибка остаётся, сообщи администратору, какую страницу открывал.</p><button onClick={()=>window.location.reload()}>Перезагрузить</button></main>:this.props.children;}
}
