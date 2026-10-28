( function () {
	'use strict';

	var fields = document.querySelectorAll( '.form-field input' );

	document.addEventListener( 'click', function ( event ) {
		var hash = String.fromCharCode( 35 );
		var popupPrefix = hash + 'popup-';
		var selector = 'a[href^="' + popupPrefix + '"]';
		var link = event.target.closest ? event.target.closest( selector ) : null;

		if ( ! link ) {
			return;
		}

		var href = link.getAttribute( 'href' ) || '';

		if ( href.indexOf( popupPrefix ) !== 0 ) {
			return;
		}

		var idPart = href.slice( popupPrefix.length );

		if ( ! /^\d+$/.test( idPart ) ) {
			return;
		}

		var popupId = Number( idPart );

		if ( ! Number.isFinite( popupId ) || popupId <= 0 || typeof window.LP_show !== 'function' ) {
			return;
		}

		event.preventDefault();
		window.LP_show( popupId );
	} );

	function updateFieldState( field ) {
		field.classList.toggle( 'has-value', field.value.trim() !== '' );
	}

	fields.forEach( function ( field ) {
		updateFieldState( field );
		field.addEventListener( 'input', function () {
			updateFieldState( field );
		} );
		field.addEventListener( 'change', function () {
			updateFieldState( field );
		} );
	} );

	document.querySelectorAll( '.service-equipment__flip-toggle' ).forEach( function ( toggle ) {
		toggle.addEventListener( 'click', function () {
			var card = toggle.closest( '.service-equipment__item' );

			if ( ! card ) {
				return;
			}

			var flipped = card.classList.toggle( 'is-flipped' );

			toggle.setAttribute( 'aria-pressed', String( flipped ) );
			toggle.setAttribute( 'aria-label', flipped ? toggle.dataset.hideLabel : toggle.dataset.showLabel );
		} );
	} );

	document.querySelectorAll( '.service-equipment__more' ).forEach( function ( button ) {
		var grid = button.previousElementSibling;

		if ( ! grid || ! grid.classList.contains( 'service-equipment__grid--collapsible' ) ) {
			return;
		}

		grid.classList.add( 'is-collapsed' );
		button.addEventListener( 'click', function () {
			var expanded = button.getAttribute( 'aria-expanded' ) !== 'true';

			grid.classList.toggle( 'is-collapsed', ! expanded );
			button.setAttribute( 'aria-expanded', String( expanded ) );
			button.textContent = expanded ? button.dataset.lessLabel : button.dataset.moreLabel;
		} );
	} );

    /* Mobile highlights: match carousel height to the visible card on smartphone-alarm pages. */
    if ( document.querySelector( '.service-application--smartphone-alarm' ) ) {
        document.querySelectorAll( '.service-hero__highlights' ).forEach( function ( list ) {
            var items = Array.prototype.slice.call( list.children );
            var timer;

            if ( ! items.length ) {
                return;
            }

            function updateHighlightsHeight() {
                if ( ! window.matchMedia( '(max-width: 767px)' ).matches ) {
                    list.style.removeProperty( 'height' );
                    return;
                }

                var listRect = list.getBoundingClientRect();
                var styles = window.getComputedStyle( list );
                var paddingLeft = parseFloat( styles.paddingLeft ) || 0;
                var paddingTop = parseFloat( styles.paddingTop ) || 0;
                var paddingBottom = parseFloat( styles.paddingBottom ) || 0;
                var targetLeft = listRect.left + paddingLeft;

                var active = items.reduce( function ( best, item ) {
                    var distance = Math.abs( item.getBoundingClientRect().left - targetLeft );
                    var bestDistance = Math.abs( best.getBoundingClientRect().left - targetLeft );

                    return distance < bestDistance ? item : best;
                } );

                var height = active.getBoundingClientRect().height + paddingTop + paddingBottom;

                list.style.setProperty( 'height', Math.ceil( height ) + 'px' );
            }

            list.addEventListener( 'scroll', function () {
                window.clearTimeout( timer );
                timer = window.setTimeout( updateHighlightsHeight, 80 );
            } );

            window.addEventListener( 'resize', updateHighlightsHeight );

            updateHighlightsHeight();
        } );
    }

    var mobileMenuToggle = document.querySelector( '.mobile-menu-toggle' );
    var mobileNavigation = document.querySelector( '#site-navigation' );

    if ( mobileMenuToggle && mobileNavigation ) {
        mobileMenuToggle.addEventListener( 'click', function () {
            var expanded = mobileMenuToggle.getAttribute( 'aria-expanded' ) === 'true';
            mobileMenuToggle.setAttribute( 'aria-expanded', String( ! expanded ) );
            mobileMenuToggle.setAttribute( 'aria-label', ! expanded ? 'Закрыть меню' : 'Открыть меню' );
            mobileNavigation.classList.toggle( 'is-mobile-open', ! expanded );
        } );
        document.addEventListener( 'keydown', function ( event ) {
            if ( event.key === 'Escape' && mobileNavigation.classList.contains( 'is-mobile-open' ) ) {
                mobileNavigation.classList.remove( 'is-mobile-open' );
                mobileMenuToggle.setAttribute( 'aria-expanded', 'false' );
                mobileMenuToggle.setAttribute( 'aria-label', 'Открыть меню' );
                mobileMenuToggle.focus();
            }
        } );
        mobileNavigation.addEventListener( 'click', function ( event ) {
            if ( event.target.closest( 'a' ) ) {
                mobileNavigation.classList.remove( 'is-mobile-open' );
                mobileMenuToggle.setAttribute( 'aria-expanded', 'false' );
                mobileMenuToggle.setAttribute( 'aria-label', 'Открыть меню' );
            }
        } );
    }

    if ( document.body.classList.contains( 'postid-17' ) || document.body.classList.contains( 'postid-16' ) ) {
        var standardsStack = document.querySelector( '.service-standards--split .service-standards__stack' );
        if ( document.body.classList.contains( 'postid-17' ) && standardsStack && standardsStack.children.length === 2 ) {
            var standardsOriginalOrder = Array.from( standardsStack.children );
            var standardsMobile = window.matchMedia( '(max-width: 767px)' );
            function orderStandards() {
                var ordered = standardsMobile.matches ? standardsOriginalOrder.slice().reverse() : standardsOriginalOrder;
                ordered.forEach( function ( card ) { standardsStack.appendChild( card ); } );
            }
            orderStandards();
            standardsMobile.addEventListener( 'change', orderStandards );
        }
        document.querySelectorAll( '.service-standards--split .service-standard' ).forEach( function ( card, index ) {
            card.setAttribute( 'role', 'button' );
            card.setAttribute( 'tabindex', '0' );
            card.setAttribute( 'aria-expanded', String( index === 0 ) );
            if ( index > 0 ) {
                card.classList.add( 'is-collapsed' );
            }
            function toggleCard() {
                if ( window.matchMedia( '(max-width: 767px)' ).matches ) {
                    card.classList.toggle( 'is-collapsed' );
                    card.setAttribute( 'aria-expanded', String( ! card.classList.contains( 'is-collapsed' ) ) );
                }
            }
            card.addEventListener( 'click', toggleCard );
            card.addEventListener( 'keydown', function ( event ) {
                if ( 'Enter' === event.key || ' ' === event.key ) {
                    event.preventDefault();
                    toggleCard();
                }
            } );
        } );
    }

    // Tariff carousel for the one mobile design which specifies snap cards and pagination.
    if ( document.body.classList.contains( 'postid-17' ) || document.body.classList.contains( 'postid-16' ) ) {
        var tariffGrid = document.querySelector( '.service-pricing__grid' );
        var tariffPagination = document.querySelector( '.service-pricing__mobile-pagination' );
        if ( tariffGrid && tariffPagination ) {
            var tariffCards = Array.prototype.slice.call( tariffGrid.querySelectorAll( '.service-tariff' ) );
            var tariffDots = Array.prototype.slice.call( tariffPagination.querySelectorAll( '[data-tariff-index]' ) );
            var tariffMatch = window.matchMedia( '(max-width: 767px)' );
            var tariffScrollQueued = false;

            function updateTariffDots() {
                if ( ! tariffMatch.matches ) { return; }
                var box = tariffGrid.getBoundingClientRect();
                var center = box.left + box.width / 2;
                var bestIndex = 0;
                var bestDistance = Infinity;
                tariffCards.forEach( function ( card, index ) {
                    var cardBox = card.getBoundingClientRect();
                    var distance = Math.abs( cardBox.left + cardBox.width / 2 - center );
                    if ( distance < bestDistance ) {
                        bestDistance = distance;
                        bestIndex = index;
                    }
                } );
                tariffDots.forEach( function ( dot, index ) {
                    dot.setAttribute( 'aria-pressed', String( index === bestIndex ) );
                } );
            }
            tariffDots.forEach( function ( dot, index ) {
                dot.addEventListener( 'click', function () {
                    if ( ! tariffMatch.matches || ! tariffCards[index] ) { return; }
                    var containerRect = tariffGrid.getBoundingClientRect();
                    var cardRect = tariffCards[index].getBoundingClientRect();
                    var offset = tariffGrid.scrollLeft + ( cardRect.left - containerRect.left ) - ( tariffGrid.clientWidth - cardRect.width ) / 2;
                    tariffGrid.scrollTo( { left: offset, behavior: window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ? 'instant' : 'smooth' } );
                } );
            } );
            tariffGrid.addEventListener( 'scroll', function () {
                if ( tariffScrollQueued ) { return; }
                tariffScrollQueued = true;
                window.requestAnimationFrame( function () {
                    tariffScrollQueued = false;
                    updateTariffDots();
                } );
            }, { passive: true } );
            window.addEventListener( 'resize', updateTariffDots );
            updateTariffDots();
        }
    }

}() );
